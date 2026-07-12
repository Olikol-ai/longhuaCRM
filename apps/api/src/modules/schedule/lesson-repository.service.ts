import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, QueryFailedError } from 'typeorm';
import { entityToRecord, recordToEntityPayload } from '../../common/utils/record.util';
import { LessonEntity } from '../../entities/lesson.entity';
import { LessonMaterialLinkEntity } from '../../entities/lesson-material-link.entity';
import { LessonStudentEntity } from '../../entities/lesson-student.entity';
import { StudentEntity } from '../../entities/student.entity';

@Injectable()
export class LessonRepositoryService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  normalizeLessonInput(input: Record<string, unknown>): {
    lessonInput: Record<string, unknown>;
    studentIds: string[] | null;
    materialIds: string[] | null;
  } {
    const studentIds = this.parseStudentIds(input);
    const materialIds = this.parseMaterialIds(input);
    const lessonInput = { ...input };
    delete lessonInput.student_ids;
    delete lessonInput.studentIds;
    delete lessonInput.student_names;
    delete lessonInput.studentNames;
    delete lessonInput.material_ids;
    delete lessonInput.materialIds;

    if (studentIds !== null && studentIds.length > 0) {
      lessonInput.student_id = studentIds[0];
      lessonInput.lesson_type = studentIds.length > 1 ? 'group' : 'individual';
    }

    return { lessonInput, studentIds, materialIds };
  }

  async enrichLessonRecords(
    records: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    if (records.length === 0) {
      return records;
    }

    const lessonIds = records.map((record) => String(record.id));
    const lsRepo = this.dataSource.getRepository(LessonStudentEntity);
    const linkRepo = this.dataSource.getRepository(LessonMaterialLinkEntity);
    const studentRepo = this.dataSource.getRepository(StudentEntity);

    const lessonStudents = await lsRepo
      .createQueryBuilder('ls')
      .where('ls.lesson_id IN (:...lessonIds)', { lessonIds })
      .getMany();
    const materialLinks = await linkRepo
      .createQueryBuilder('lml')
      .where('lml.lesson_id IN (:...lessonIds)', { lessonIds })
      .getMany();

    const allStudentIds = [...new Set(lessonStudents.map((row) => row.studentId))];
    const students = allStudentIds.length
      ? await studentRepo
          .createQueryBuilder('s')
          .where('s.id IN (:...ids)', { ids: allStudentIds })
          .getMany()
      : [];
    const studentNameById = new Map(students.map((student) => [student.id, student.name]));

    const studentsByLesson = new Map<string, string[]>();
    const namesByLesson = new Map<string, string[]>();
    for (const row of lessonStudents) {
      const lessonId = String(row.lessonId);
      if (!studentsByLesson.has(lessonId)) {
        studentsByLesson.set(lessonId, []);
        namesByLesson.set(lessonId, []);
      }
      studentsByLesson.get(lessonId)!.push(String(row.studentId));
      const name = studentNameById.get(row.studentId);
      if (name) {
        namesByLesson.get(lessonId)!.push(name);
      }
    }

    const materialsByLesson = new Map<string, string[]>();
    for (const link of materialLinks) {
      const lessonId = String(link.lessonId);
      if (!materialsByLesson.has(lessonId)) {
        materialsByLesson.set(lessonId, []);
      }
      materialsByLesson.get(lessonId)!.push(String(link.materialId));
    }

    return records.map((record) => {
      const lessonId = String(record.id);
      const student_ids =
        studentsByLesson.get(lessonId) ??
        (record.student_id ? [String(record.student_id)] : []);
      const student_names =
        namesByLesson.get(lessonId) ??
        (record.student_name ? [String(record.student_name)] : []);
      const material_ids = materialsByLesson.get(lessonId) ?? [];
      return { ...record, student_ids, student_names, material_ids };
    });
  }

  async persistLessonCreate(
    payloadInput: Record<string, unknown>,
    studentIds: string[] | null,
    materialIds: string[] | null,
    manager: EntityManager,
  ): Promise<LessonEntity> {
    const lessonRepo = manager.getRepository(LessonEntity);
    const now = new Date();
    const id = payloadInput.id ? String(payloadInput.id) : randomUUID();
    const payload = recordToEntityPayload(payloadInput);

    const row = lessonRepo.create({
      id,
      ...payload,
      createdDate: now,
      updatedDate: now,
    });

    let saved: LessonEntity;
    try {
      saved = await lessonRepo.save(row);
    } catch (error) {
      const raced = await this.findRacedRecurringLesson(payloadInput, manager, error);
      if (raced) {
        return raced;
      }
      throw error;
    }

    const lessonId = String(saved.id);
    const idsToSync =
      studentIds ?? (saved.studentId ? [String(saved.studentId)] : []);

    if (studentIds !== null || idsToSync.length > 0) {
      await this.syncLessonStudents(lessonId, idsToSync, manager);
      await this.refreshLessonStudentFields(lessonId, manager);
    }

    if (materialIds !== null) {
      await this.syncLessonMaterialLinks(lessonId, materialIds, manager);
    }

    const refreshed = await lessonRepo.findOne({ where: { id: saved.id } });
    return (refreshed ?? saved) as LessonEntity;
  }

  async persistLessonUpdate(
    id: string,
    rawInput: Record<string, unknown>,
    lessonInput: Record<string, unknown>,
    studentIds: string[] | null,
    materialIds: string[] | null,
    manager: EntityManager,
  ): Promise<LessonEntity> {
    const lessonRepo = manager.getRepository(LessonEntity);
    const managedRow = await lessonRepo.findOne({ where: { id } });
    if (!managedRow) {
      throw new Error('Lesson not found');
    }

    const payload = recordToEntityPayload(lessonInput);
    Object.assign(managedRow, payload);

    const scheduleFieldsChanged =
      rawInput.teacher_id !== undefined ||
      rawInput.teacherId !== undefined ||
      rawInput.date !== undefined ||
      rawInput.start_time !== undefined ||
      rawInput.startTime !== undefined ||
      rawInput.duration !== undefined ||
      rawInput.schedule_slot_id !== undefined ||
      rawInput.scheduleSlotId !== undefined;

    const contentFieldsChanged =
      rawInput.meeting_link !== undefined ||
      rawInput.meetingLink !== undefined ||
      rawInput.notes !== undefined ||
      rawInput.lesson_format !== undefined ||
      rawInput.lessonFormat !== undefined;

    const studentsChanged = studentIds !== null;

    if (scheduleFieldsChanged || contentFieldsChanged || studentsChanged) {
      managedRow.manuallyModified = true;
    }

    managedRow.updatedDate = new Date();
    const saved = await lessonRepo.save(managedRow);

    if (studentIds !== null) {
      await this.syncLessonStudents(id, studentIds, manager);
      await this.refreshLessonStudentFields(id, manager);
    }

    if (materialIds !== null) {
      await this.syncLessonMaterialLinks(id, materialIds, manager);
    }

    const refreshed = await lessonRepo.findOne({ where: { id } });
    return (refreshed ?? saved) as LessonEntity;
  }

  async deleteLessonRows(lessonId: string, manager: EntityManager): Promise<void> {
    await manager.getRepository(LessonStudentEntity).delete({ lessonId });
    await manager.getRepository(LessonEntity).delete({ id: lessonId });
  }

  toEnrichedRecord(entity: LessonEntity): Promise<Record<string, unknown>> {
    const record = entityToRecord(entity as unknown as Record<string, unknown>);
    return this.enrichLessonRecords([record]).then((rows) => rows[0]);
  }

  async refreshLessonStudentFields(
    lessonId: string,
    manager?: EntityManager,
  ): Promise<void> {
    if (!lessonId) return;

    const lsRepo = manager
      ? manager.getRepository(LessonStudentEntity)
      : this.dataSource.getRepository(LessonStudentEntity);
    const lessonRepo = manager
      ? manager.getRepository(LessonEntity)
      : this.dataSource.getRepository(LessonEntity);

    const lesson = await lessonRepo.findOne({ where: { id: lessonId } });
    if (!lesson) return;

    const rows = await lsRepo.find({ where: { lessonId } });
    const ids = rows.map((row) => String(row.studentId));

    lesson.studentId = ids[0] ?? null;
    lesson.lessonType = ids.length > 1 ? 'group' : 'individual';
    lesson.updatedDate = new Date();
    await lessonRepo.save(lesson);
  }

  private parseStudentIds(input: Record<string, unknown>): string[] | null {
    if ('student_ids' in input) {
      const value = input.student_ids;
      if (Array.isArray(value)) {
        return value.map(String).filter(Boolean);
      }
      if (typeof value === 'string' && value.trim()) {
        return value.split(',').map((part) => part.trim()).filter(Boolean);
      }
      return [];
    }
    if ('studentIds' in input) {
      const value = input.studentIds;
      if (Array.isArray(value)) {
        return value.map(String).filter(Boolean);
      }
    }
    return null;
  }

  private parseMaterialIds(input: Record<string, unknown>): string[] | null {
    if ('material_ids' in input) {
      const value = input.material_ids;
      if (Array.isArray(value)) {
        return value.map(String).filter(Boolean);
      }
      if (typeof value === 'string' && value.trim()) {
        return value.split(',').map((part) => part.trim()).filter(Boolean);
      }
      return [];
    }
    if ('materialIds' in input) {
      const value = input.materialIds;
      if (Array.isArray(value)) {
        return value.map(String).filter(Boolean);
      }
    }
    return null;
  }

  private async syncLessonStudents(
    lessonId: string,
    studentIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LessonStudentEntity)
      : this.dataSource.getRepository(LessonStudentEntity);
    const uniqueIds = [...new Set(studentIds.map(String).filter(Boolean))];

    await repo.delete({ lessonId });

    if (uniqueIds.length === 0) {
      return;
    }

    const now = new Date();
    for (const studentId of uniqueIds) {
      await repo.save(
        repo.create({
          id: randomUUID(),
          lessonId,
          studentId,
          attendanceStatus: 'enrolled',
          balanceDeducted: false,
          createdDate: now,
          updatedDate: now,
        }),
      );
    }
  }

  private async syncLessonMaterialLinks(
    lessonId: string,
    materialIds: string[],
    manager?: EntityManager,
  ): Promise<void> {
    const repo = manager
      ? manager.getRepository(LessonMaterialLinkEntity)
      : this.dataSource.getRepository(LessonMaterialLinkEntity);
    const uniqueIds = [...new Set(materialIds.map(String).filter(Boolean))];

    await repo.delete({ lessonId });

    if (uniqueIds.length === 0) {
      return;
    }

    const now = new Date();
    for (const materialId of uniqueIds) {
      await repo.save(
        repo.create({
          id: randomUUID(),
          lessonId,
          materialId,
          createdDate: now,
          updatedDate: now,
        }),
      );
    }
  }

  private async findRacedRecurringLesson(
    payloadInput: Record<string, unknown>,
    manager: EntityManager,
    error: unknown,
  ): Promise<LessonEntity | null> {
    if (!(error instanceof QueryFailedError)) {
      return null;
    }
    const driverError = (error as QueryFailedError & { driverError?: { code?: string } }).driverError;
    if (driverError?.code !== '23505') {
      return null;
    }

    const seriesId = payloadInput.recurrence_series_id ?? payloadInput.recurrenceSeriesId;
    const recurrenceIndex = payloadInput.recurrence_index ?? payloadInput.recurrenceIndex;
    if (seriesId == null || recurrenceIndex == null) {
      return null;
    }

    return manager.getRepository(LessonEntity).findOne({
      where: {
        recurrenceSeriesId: String(seriesId),
        recurrenceIndex: Number(recurrenceIndex),
      },
    });
  }
}
