import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { LessonEntity } from '../../entities/Lesson.entity';
import { EntityAccessContext } from '../entities/entity-access.types';
import { StudentBalanceService } from '../students/student-balance.service';
import { LessonRepositoryService } from './lesson-repository.service';
import { LessonSeriesService } from './lesson-series.service';
import { TeacherAvailabilityBookingService } from './teacher-availability-booking.service';

@Injectable()
export class LessonOrchestratorService {
  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly lessonRepository: LessonRepositoryService,
    private readonly lessonSeries: LessonSeriesService,
    private readonly availabilityBooking: TeacherAvailabilityBookingService,
    private readonly studentBalanceService: StudentBalanceService,
  ) {}

  normalizeInput(input: Record<string, unknown>) {
    return this.lessonRepository.normalizeLessonInput(input);
  }

  toEnrichedRecord(entity: LessonEntity) {
    return this.lessonRepository.toEnrichedRecord(entity);
  }

  async createLesson(
    input: Record<string, unknown>,
    _context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    const { lessonInput, studentIds, materialIds } = this.normalizeInput(input);

    return this.dataSource.transaction(async (manager) => {
      const saved = await this.persistLessonWithBooking(
        lessonInput,
        studentIds,
        materialIds,
        manager,
      );

      const refreshed = await manager.getRepository(LessonEntity).findOne({
        where: { id: saved.id },
      });
      return this.toEnrichedRecord((refreshed ?? saved) as LessonEntity);
    });
  }

  async createLessonWithManager(
    input: Record<string, unknown>,
    _context: EntityAccessContext,
    manager: EntityManager,
  ): Promise<Record<string, unknown>> {
    const { lessonInput, studentIds, materialIds } = this.normalizeInput(input);

    const saved = await this.persistLessonWithBooking(
      lessonInput,
      studentIds,
      materialIds,
      manager,
    );

    const refreshed = await manager.getRepository(LessonEntity).findOne({
      where: { id: saved.id },
    });
    return this.toEnrichedRecord((refreshed ?? saved) as LessonEntity);
  }

  async updateLesson(
    id: string,
    input: Record<string, unknown>,
    _context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    const { lessonInput, studentIds, materialIds } = this.normalizeInput(input);

    return this.dataSource.transaction(async (manager) => {
      const lessonRepo = manager.getRepository(LessonEntity);
      const beforeUpdate = await lessonRepo.findOne({ where: { id } });
      if (!beforeUpdate) {
        throw new NotFoundException('Lesson not found');
      }

      const saved = await this.lessonRepository.persistLessonUpdate(
        id,
        input,
        lessonInput,
        studentIds,
        materialIds,
        manager,
      );

      const nextStatus = String(saved.status ?? 'planned');
      const scheduleChanged = this.hasScheduleFieldsChanged(input);

      if (nextStatus === 'cancelled') {
        await this.availabilityBooking.cancelBookingsForLesson(id, manager);
      } else if (scheduleChanged || lessonInput.status !== undefined) {
        await this.availabilityBooking.syncBookingForLessonUpdate(
          id,
          {
            lessonId: id,
            teacherId: String(saved.teacherId),
            date: String(saved.date),
            startTime: String(saved.startTime),
            duration: Number(saved.duration) || 60,
          },
          manager,
        );
      }

      if (lessonInput.status !== undefined) {
        await this.studentBalanceService.handleLessonStatusUpdate(
          id,
          String(lessonInput.status),
        );
      }

      const refreshed = await lessonRepo.findOne({ where: { id } });
      return this.toEnrichedRecord((refreshed ?? saved) as LessonEntity);
    });
  }

  async deleteLesson(id: string): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const lessonRow = await manager.getRepository(LessonEntity).findOne({ where: { id } });
      if (!lessonRow) {
        throw new NotFoundException('Lesson not found');
      }

      if (lessonRow.recurrenceSeriesId != null && lessonRow.recurrenceIndex != null) {
        await this.lessonSeries.recordDeletedRecurrenceInstance(
          lessonRow.recurrenceSeriesId,
          lessonRow.recurrenceIndex,
          manager,
        );
      }

      await this.availabilityBooking.cancelBookingsForLesson(id, manager);
      await this.lessonRepository.deleteLessonRows(id, manager);
    });
  }

  async persistLessonWithBooking(
    payloadInput: Record<string, unknown>,
    studentIds: string[] | null,
    materialIds: string[] | null,
    manager: EntityManager,
  ): Promise<LessonEntity> {
    const saved = await this.lessonRepository.persistLessonCreate(
      payloadInput,
      studentIds,
      materialIds,
      manager,
    );

    await this.availabilityBooking.createBookingForLesson(
      {
        lessonId: String(saved.id),
        teacherId: String(saved.teacherId),
        date: String(saved.date),
        startTime: String(saved.startTime),
        duration: Number(saved.duration) || 60,
      },
      manager,
    );

    return saved;
  }

  private hasScheduleFieldsChanged(input: Record<string, unknown>): boolean {
    return (
      input.teacher_id !== undefined ||
      input.teacherId !== undefined ||
      input.date !== undefined ||
      input.start_time !== undefined ||
      input.startTime !== undefined ||
      input.duration !== undefined ||
      input.schedule_slot_id !== undefined ||
      input.scheduleSlotId !== undefined
    );
  }
}
