import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource, EntityManager, In, QueryFailedError } from 'typeorm';
import { LessonEntity } from '../../entities/lesson.entity';
import { LessonSeriesEntity } from '../../entities/lesson-series.entity';
import { LessonSeriesExclusionEntity } from '../../entities/lesson-series-exclusion.entity';
import { LessonSeriesStudentEntity } from '../../entities/lesson-series-student.entity';
import { StudentEntity } from '../../entities/student.entity';
import { TeacherEntity } from '../../entities/teacher.entity';
import { addUtcDays, normalizeSeriesTime } from './lesson-series-date.util';

export type RecurringLessonPrepareInput = {
  lessonInput: Record<string, unknown>;
  studentIds: string[];
};

export type RecurringLessonBootstrapInstance = {
  recurrenceIndex: number;
  date: string;
};

export type RecurringLessonPrepareResult = {
  recurrenceSeriesId: string;
  recurrenceIndex: number;
  recurringGroupId: string;
  existingLessonId?: string;
  bootstrapSecondInstance?: RecurringLessonBootstrapInstance;
};

@Injectable()
export class LessonSeriesService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async prepareRecurringLessonCreate(
    input: RecurringLessonPrepareInput,
    manager: EntityManager,
  ): Promise<RecurringLessonPrepareResult> {
    const { lessonInput, studentIds } = input;
    const requestedSeriesId = String(
      lessonInput.recurring_group_id ??
        lessonInput.recurringGroupId ??
        lessonInput.recurrence_series_id ??
        lessonInput.recurrenceSeriesId ??
        '',
    ).trim();

    if (!requestedSeriesId) {
      throw new BadRequestException('recurring_group_id is required for recurring lessons');
    }

    const presetSeriesId = lessonInput.recurrence_series_id ?? lessonInput.recurrenceSeriesId;
    const presetIndex = lessonInput.recurrence_index ?? lessonInput.recurrenceIndex;
    if (presetSeriesId != null && presetIndex != null) {
      return this.preparePresetInstance(
        String(presetSeriesId),
        Number(presetIndex),
        lessonInput,
        manager,
      );
    }

    if (studentIds.length === 0) {
      throw new BadRequestException('At least one student is required for recurring lessons');
    }

    const teacherId = String(lessonInput.teacher_id ?? lessonInput.teacherId ?? '');
    const startDate = String(lessonInput.date ?? '');
    const startTime = normalizeSeriesTime(
      String(lessonInput.start_time ?? lessonInput.startTime ?? '10:00'),
    );
    const scheduleSlotId = lessonInput.schedule_slot_id
      ? String(lessonInput.schedule_slot_id)
      : lessonInput.scheduleSlotId
        ? String(lessonInput.scheduleSlotId)
        : null;

    const signatureSeries = await this.findActiveSeriesBySignature(
      teacherId,
      scheduleSlotId,
      startDate,
      startTime,
      manager,
    );

    const seriesRepo = manager.getRepository(LessonSeriesEntity);
    let series =
      signatureSeries ??
      (await seriesRepo.findOne({ where: { id: requestedSeriesId } }));

    if (!series) {
      series = await this.createSeriesFromLessonInput(
        requestedSeriesId,
        lessonInput,
        studentIds,
        manager,
      );

      const existingIndex0 = await this.findExistingSeriesInstance(
        series.id,
        0,
        series.teacherId,
        startDate,
        series.scheduleSlotId,
        manager,
      );
      if (existingIndex0) {
        return {
          recurrenceSeriesId: series.id,
          recurrenceIndex: 0,
          recurringGroupId: series.id,
          existingLessonId: existingIndex0.id,
        };
      }

      return {
        recurrenceSeriesId: series.id,
        recurrenceIndex: 0,
        recurringGroupId: series.id,
        bootstrapSecondInstance: {
          recurrenceIndex: 1,
          date: addUtcDays(startDate, 7),
        },
      };
    }

    if (series.status === 'stopped' || !series.repeatWeekly) {
      throw new ConflictException('Lesson series is stopped and cannot accept new instances');
    }

    const lessonRepo = manager.getRepository(LessonEntity);
    const latest = await lessonRepo.findOne({
      where: { recurrenceSeriesId: series.id },
      order: { recurrenceIndex: 'DESC' },
    });
    const recurrenceIndex = latest?.recurrenceIndex != null ? latest.recurrenceIndex + 1 : 0;
    const instanceDate = String(lessonInput.date ?? startDate);

    const existing = await this.findExistingSeriesInstance(
      series.id,
      recurrenceIndex,
      String(lessonInput.teacher_id ?? lessonInput.teacherId ?? series.teacherId),
      instanceDate,
      lessonInput.schedule_slot_id
        ? String(lessonInput.schedule_slot_id)
        : lessonInput.scheduleSlotId
          ? String(lessonInput.scheduleSlotId)
          : series.scheduleSlotId,
      manager,
    );

    if (existing) {
      return {
        recurrenceSeriesId: series.id,
        recurrenceIndex,
        recurringGroupId: series.id,
        existingLessonId: existing.id,
      };
    }

    if (await this.isRecurrenceIndexExcluded(series.id, recurrenceIndex, manager)) {
      throw new ConflictException('This recurrence instance was intentionally removed');
    }

    return {
      recurrenceSeriesId: series.id,
      recurrenceIndex,
      recurringGroupId: series.id,
    };
  }

  async planNextScheduledInstance(
    series: LessonSeriesEntity,
    manager: EntityManager,
  ): Promise<{ payload: Record<string, unknown> } | null> {
    const canGenerate = await this.canGenerateForSeries(series, manager);
    if (!canGenerate) {
      return null;
    }

    const latest = await manager.getRepository(LessonEntity).findOne({
      where: { recurrenceSeriesId: series.id },
      order: { recurrenceIndex: 'DESC' },
    });

    if (!latest || latest.recurrenceIndex == null) {
      return null;
    }

    const nextIndex = latest.recurrenceIndex + 1;
    const nextDate = addUtcDays(String(latest.date), 7);

    const exists = await this.seriesInstanceExists(
      series.id,
      nextIndex,
      series.teacherId,
      nextDate,
      series.scheduleSlotId,
      manager,
    );

    if (exists) {
      return null;
    }

    const studentIds = await this.getSeriesStudentIds(series.id, manager);
    const payload = await this.buildScheduledLessonPayload(
      series,
      studentIds,
      nextDate,
      nextIndex,
      manager,
    );

    return { payload };
  }

  async isSeriesInstanceOccupied(
    seriesId: string,
    recurrenceIndex: number,
    teacherId: string,
    date: string,
    scheduleSlotId: string | null,
    manager: EntityManager,
  ): Promise<boolean> {
    return this.seriesInstanceExists(
      seriesId,
      recurrenceIndex,
      teacherId,
      date,
      scheduleSlotId,
      manager,
    );
  }

  async recordDeletedRecurrenceInstance(
    seriesId: string,
    recurrenceIndex: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(LessonSeriesExclusionEntity);
    const existing = await repo.findOne({
      where: { seriesId, recurrenceIndex },
    });
    if (existing) {
      return;
    }

    await repo.save(
      repo.create({
        id: randomUUID(),
        seriesId,
        recurrenceIndex,
        reason: 'deleted',
      }),
    );
  }

  async stopSeries(seriesId: string, manager?: EntityManager): Promise<void> {
    const repo = manager
      ? manager.getRepository(LessonSeriesEntity)
      : this.dataSource.getRepository(LessonSeriesEntity);

    await repo.update(
      { id: seriesId },
      { status: 'stopped', repeatWeekly: false, updatedDate: new Date() },
    );
  }

  private async preparePresetInstance(
    seriesId: string,
    recurrenceIndex: number,
    lessonInput: Record<string, unknown>,
    manager: EntityManager,
  ): Promise<RecurringLessonPrepareResult> {
    const series = await manager.getRepository(LessonSeriesEntity).findOne({
      where: { id: seriesId },
    });
    if (!series || series.status === 'stopped' || !series.repeatWeekly) {
      throw new ConflictException('Lesson series is stopped and cannot accept new instances');
    }

    const existing = await this.findExistingSeriesInstance(
      seriesId,
      recurrenceIndex,
      String(lessonInput.teacher_id ?? lessonInput.teacherId ?? series.teacherId),
      String(lessonInput.date ?? ''),
      lessonInput.schedule_slot_id
        ? String(lessonInput.schedule_slot_id)
        : lessonInput.scheduleSlotId
          ? String(lessonInput.scheduleSlotId)
          : series.scheduleSlotId,
      manager,
    );

    if (existing) {
      return {
        recurrenceSeriesId: seriesId,
        recurrenceIndex,
        recurringGroupId: seriesId,
        existingLessonId: existing.id,
      };
    }

    if (await this.isRecurrenceIndexExcluded(seriesId, recurrenceIndex, manager)) {
      throw new ConflictException('This recurrence instance was intentionally removed');
    }

    return {
      recurrenceSeriesId: seriesId,
      recurrenceIndex,
      recurringGroupId: seriesId,
    };
  }

  private async findActiveSeriesBySignature(
    teacherId: string,
    scheduleSlotId: string | null,
    startDate: string,
    startTime: string,
    manager: EntityManager,
  ): Promise<LessonSeriesEntity | null> {
    const qb = manager
      .getRepository(LessonSeriesEntity)
      .createQueryBuilder('s')
      .where('s.teacher_id = :teacherId', { teacherId })
      .andWhere('s.start_date = :startDate', { startDate })
      .andWhere('s.start_time = :startTime', { startTime })
      .andWhere('s.status = :status', { status: 'active' });

    if (scheduleSlotId) {
      qb.andWhere('s.schedule_slot_id = :scheduleSlotId', { scheduleSlotId });
    } else {
      qb.andWhere('s.schedule_slot_id IS NULL');
    }

    return qb.getOne();
  }

  private async createSeriesFromLessonInput(
    seriesId: string,
    lessonInput: Record<string, unknown>,
    studentIds: string[],
    manager: EntityManager,
  ): Promise<LessonSeriesEntity> {
    const teacherId = String(lessonInput.teacher_id ?? lessonInput.teacherId ?? '');
    const startDate = String(lessonInput.date ?? '');
    const startTime = normalizeSeriesTime(
      String(lessonInput.start_time ?? lessonInput.startTime ?? '10:00'),
    );
    const scheduleSlotId = lessonInput.schedule_slot_id
      ? String(lessonInput.schedule_slot_id)
      : lessonInput.scheduleSlotId
        ? String(lessonInput.scheduleSlotId)
        : null;

    const existingBySignature = await this.findActiveSeriesBySignature(
      teacherId,
      scheduleSlotId,
      startDate,
      startTime,
      manager,
    );
    if (existingBySignature) {
      return existingBySignature;
    }

    const now = new Date();
    const seriesRepo = manager.getRepository(LessonSeriesEntity);

    const series = seriesRepo.create({
      id: seriesId,
      teacherId,
      scheduleSlotId,
      repeatWeekly: true,
      status: 'active',
      startDate,
      startTime,
      duration: Number(lessonInput.duration ?? 60) || 60,
      lessonFormat: (lessonInput.lesson_format ?? lessonInput.lessonFormat ?? 'online') as
        | 'online'
        | 'offline',
      meetingLink: lessonInput.meeting_link
        ? String(lessonInput.meeting_link)
        : lessonInput.meetingLink
          ? String(lessonInput.meetingLink)
          : null,
      notes: lessonInput.notes ? String(lessonInput.notes) : null,
      teacherName: lessonInput.teacher_name ? String(lessonInput.teacher_name) : null,
      teacherFirstName: lessonInput.teacher_first_name
        ? String(lessonInput.teacher_first_name)
        : null,
      teacherLastName: lessonInput.teacher_last_name ? String(lessonInput.teacher_last_name) : null,
      createdDate: now,
      updatedDate: now,
    });

    try {
      const saved = await seriesRepo.save(series);
      await this.syncSeriesStudents(saved.id, studentIds, manager);
      return saved;
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        const raced = await this.findActiveSeriesBySignature(
          teacherId,
          scheduleSlotId,
          startDate,
          startTime,
          manager,
        );
        if (raced) {
          return raced;
        }
      }
      throw error;
    }
  }

  private async syncSeriesStudents(
    seriesId: string,
    studentIds: string[],
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(LessonSeriesStudentEntity);
    const uniqueIds = [...new Set(studentIds.map(String).filter(Boolean))];
    const now = new Date();

    for (const studentId of uniqueIds) {
      const existing = await repo.findOne({ where: { seriesId, studentId } });
      if (existing) {
        continue;
      }
      await repo.save(
        repo.create({
          id: randomUUID(),
          seriesId,
          studentId,
          createdDate: now,
          updatedDate: now,
        }),
      );
    }
  }

  private async findExistingSeriesInstance(
    seriesId: string,
    recurrenceIndex: number,
    teacherId: string,
    date: string,
    scheduleSlotId: string | null | undefined,
    manager: EntityManager,
  ): Promise<LessonEntity | null> {
    const lessonRepo = manager.getRepository(LessonEntity);
    const byIndex = await lessonRepo.findOne({
      where: { recurrenceSeriesId: seriesId, recurrenceIndex },
    });
    if (byIndex) {
      return byIndex;
    }

    const slotId = scheduleSlotId ? String(scheduleSlotId) : null;
    const slotMatches = await lessonRepo.find({
      where: {
        teacherId,
        date,
        ...(slotId ? { scheduleSlotId: slotId } : {}),
      },
    });

    const candidates = slotId
      ? slotMatches
      : slotMatches.filter((lesson) => !lesson.scheduleSlotId);

    return candidates[0] ?? null;
  }

  private async seriesInstanceExists(
    seriesId: string,
    recurrenceIndex: number,
    teacherId: string,
    date: string,
    scheduleSlotId: string | null,
    manager: EntityManager,
  ): Promise<boolean> {
    if (await this.isRecurrenceIndexExcluded(seriesId, recurrenceIndex, manager)) {
      return true;
    }

    const existing = await this.findExistingSeriesInstance(
      seriesId,
      recurrenceIndex,
      teacherId,
      date,
      scheduleSlotId,
      manager,
    );
    return existing != null;
  }

  private async isRecurrenceIndexExcluded(
    seriesId: string,
    recurrenceIndex: number,
    manager: EntityManager,
  ): Promise<boolean> {
    const row = await manager.getRepository(LessonSeriesExclusionEntity).findOne({
      where: { seriesId, recurrenceIndex },
    });
    return row != null;
  }

  private async canGenerateForSeries(
    series: LessonSeriesEntity,
    manager: EntityManager,
  ): Promise<boolean> {
    if (series.status !== 'active' || !series.repeatWeekly) {
      return false;
    }

    const teacher = await manager.getRepository(TeacherEntity).findOne({
      where: { id: series.teacherId },
    });
    if (!teacher || teacher.status !== 'active') {
      return false;
    }

    const studentIds = await this.getSeriesStudentIds(series.id, manager);
    if (studentIds.length === 0) {
      return false;
    }

    const students = await manager.getRepository(StudentEntity).find({
      where: { id: In(studentIds) },
    });

    return (
      students.length === studentIds.length &&
      students.every((student) => student.status === 'active')
    );
  }

  private async getSeriesStudentIds(
    seriesId: string,
    manager?: EntityManager,
  ): Promise<string[]> {
    const repo = manager
      ? manager.getRepository(LessonSeriesStudentEntity)
      : this.dataSource.getRepository(LessonSeriesStudentEntity);
    const rows = await repo.find({
      where: { seriesId },
      select: ['studentId'],
    });
    return rows.map((row) => row.studentId).sort();
  }

  private async buildScheduledLessonPayload(
    series: LessonSeriesEntity,
    studentIds: string[],
    date: string,
    recurrenceIndex: number,
    manager: EntityManager,
  ): Promise<Record<string, unknown>> {
    const students = await manager.getRepository(StudentEntity).find({
      where: { id: In(studentIds) },
    });
    const studentMap = new Map(students.map((student) => [student.id, student]));
    const orderedStudents = studentIds.map((id) => studentMap.get(id)).filter(Boolean);

    return {
      teacher_id: series.teacherId,
      teacher_name: series.teacherName,
      teacher_first_name: series.teacherFirstName,
      teacher_last_name: series.teacherLastName,
      student_id: studentIds[0],
      student_ids: studentIds,
      student_name: orderedStudents[0]?.name ?? '',
      student_names: orderedStudents.map((student) => student!.name),
      student_first_name: orderedStudents[0]?.firstName ?? '',
      student_last_name: orderedStudents[0]?.lastName ?? '',
      date,
      start_time: normalizeSeriesTime(String(series.startTime)),
      duration: series.duration,
      meeting_link: series.meetingLink,
      status: 'planned',
      lesson_format: series.lessonFormat,
      lesson_type: studentIds.length > 1 ? 'group' : 'individual',
      notes: series.notes,
      is_recurring: true,
      recurring_group_id: series.id,
      recurrence_series_id: series.id,
      recurrence_index: recurrenceIndex,
      schedule_slot_id: series.scheduleSlotId,
    };
  }

  private isUniqueViolation(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) {
      return false;
    }
    const driverError = (error as QueryFailedError & { driverError?: { code?: string } }).driverError;
    return driverError?.code === '23505';
  }
}
