import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EntityName } from '../../common/constants/entity-names';
import { LessonMaterialTagEntity } from '../../entities/lesson-material-tag.entity';
import { LessonSeriesStudentEntity } from '../../entities/lesson-series-student.entity';
import { TeacherAvailabilitySlotEntity } from '../../entities/teacher-availability-slot.entity';
import { LessonRepositoryService } from './lesson-repository.service';

@Injectable()
export class EntityEnrichmentService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly lessonRepository: LessonRepositoryService,
  ) {}

  async enrich(entity: EntityName, records: Record<string, unknown>[]): Promise<Record<string, unknown>[]> {
    if (records.length === 0) {
      return records;
    }

    switch (entity) {
      case 'Lesson':
        return this.lessonRepository.enrichLessonRecords(records);
      case 'TeacherAvailability':
        return this.enrichTeacherAvailabilityRecords(records);
      case 'LessonSeries':
        return this.enrichLessonSeriesRecords(records);
      case 'LessonMaterial':
        return this.enrichLessonMaterialRecords(records);
      default:
        return records;
    }
  }

  private async enrichLessonSeriesRecords(
    records: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const seriesIds = records.map((record) => String(record.id));
    if (seriesIds.length === 0) {
      return records;
    }

    const rows = await this.dataSource
      .getRepository(LessonSeriesStudentEntity)
      .createQueryBuilder('lss')
      .where('lss.series_id IN (:...seriesIds)', { seriesIds })
      .getMany();

    const studentsBySeries = new Map<string, string[]>();
    for (const row of rows) {
      const seriesId = String(row.seriesId);
      if (!studentsBySeries.has(seriesId)) {
        studentsBySeries.set(seriesId, []);
      }
      studentsBySeries.get(seriesId)!.push(String(row.studentId));
    }

    return records.map((record) => ({
      ...record,
      student_ids: studentsBySeries.get(String(record.id)) ?? [],
    }));
  }

  private async enrichTeacherAvailabilityRecords(
    records: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const teacherIds = [
      ...new Set(
        records
          .map((record) => String(record.teacher_id ?? record.teacherId ?? ''))
          .filter(Boolean),
      ),
    ];
    if (teacherIds.length === 0) {
      return records.map((record) => ({ ...record, slots: [] }));
    }

    const slotRepo = this.dataSource.getRepository(TeacherAvailabilitySlotEntity);
    const allSlots = await slotRepo
      .createQueryBuilder('slot')
      .where('slot.teacher_id IN (:...teacherIds)', { teacherIds })
      .orderBy('slot.day_of_week', 'ASC')
      .addOrderBy('slot.time_from', 'ASC')
      .getMany();

    const slotsByTeacher = new Map<string, { day: number; from: string; to: string }[]>();
    for (const slot of allSlots) {
      const teacherId = String(slot.teacherId);
      if (!slotsByTeacher.has(teacherId)) {
        slotsByTeacher.set(teacherId, []);
      }
      slotsByTeacher.get(teacherId)!.push({
        day: slot.dayOfWeek,
        from: this.formatTimeValue(slot.timeFrom),
        to: this.formatTimeValue(slot.timeTo),
      });
    }

    return records.map((record) => {
      const teacherId = String(record.teacher_id ?? record.teacherId ?? '');
      return { ...record, slots: slotsByTeacher.get(teacherId) ?? [] };
    });
  }

  private async enrichLessonMaterialRecords(
    records: Record<string, unknown>[],
  ): Promise<Record<string, unknown>[]> {
    const materialIds = records.map((record) => String(record.id));
    const tagRepo = this.dataSource.getRepository(LessonMaterialTagEntity);
    const allTags = await tagRepo
      .createQueryBuilder('tag')
      .where('tag.material_id IN (:...materialIds)', { materialIds })
      .getMany();

    const tagsByMaterial = new Map<string, string[]>();
    for (const row of allTags) {
      const materialId = String(row.materialId);
      if (!tagsByMaterial.has(materialId)) {
        tagsByMaterial.set(materialId, []);
      }
      tagsByMaterial.get(materialId)!.push(row.tag);
    }

    return records.map((record) => ({
      ...record,
      tags: tagsByMaterial.get(String(record.id)) ?? [],
    }));
  }

  private formatTimeValue(value: string): string {
    if (!value) return value;
    return value.length >= 5 ? value.slice(0, 5) : value;
  }
}
