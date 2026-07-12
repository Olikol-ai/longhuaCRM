import { ForbiddenException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { entityToRecord, recordToEntityPayload } from '../../common/utils/record.util';
import { LessonEntity } from '../../entities/lesson.entity';
import { LessonSeriesEntity } from '../../entities/lesson-series.entity';
import { EntityAccessContext } from '../entities/entity-access.types';
import { EntityEnrichmentService } from './entity-enrichment.service';
import { LessonOrchestratorService } from './lesson-orchestrator.service';
import { LessonSeriesService } from './lesson-series.service';

const SYSTEM_CONTEXT: EntityAccessContext = {
  userId: 'system',
  role: 'admin',
  ownedStudentIds: [],
  ownedTeacherId: null,
  assignedStudentIds: [],
};

@Injectable()
export class LessonSeriesOrchestratorService implements OnModuleInit {
  private readonly logger = new Logger(LessonSeriesOrchestratorService.name);

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly lessonSeries: LessonSeriesService,
    private readonly lessonOrchestrator: LessonOrchestratorService,
    private readonly enrichment: EntityEnrichmentService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit(): void {
    if (!this.config.get<boolean>('jobs.enabled')) {
      return;
    }

    void this.maintainActiveSeries().catch((error) => {
      this.logger.warn(`Bootstrap series maintenance skipped: ${(error as Error).message}`);
    });
  }

  async createRecurringLesson(
    input: Record<string, unknown>,
    context: EntityAccessContext,
  ): Promise<Record<string, unknown>> {
    const normalized = this.lessonOrchestrator.normalizeInput(input);
    const { lessonInput, studentIds, materialIds } = normalized;
    const resolvedStudentIds =
      studentIds ?? (lessonInput.student_id ? [String(lessonInput.student_id)] : []);

    return this.dataSource.transaction(async (manager) => {
      let payloadInput: Record<string, unknown> = { ...lessonInput };
      let bootstrapSecondInstance: { recurrenceIndex: number; date: string } | undefined;

      const seriesMeta = await this.lessonSeries.prepareRecurringLessonCreate(
        { lessonInput: payloadInput, studentIds: resolvedStudentIds },
        manager,
      );

      if (seriesMeta.existingLessonId) {
        const existing = await manager.getRepository(LessonEntity).findOne({
          where: { id: seriesMeta.existingLessonId },
        });
        if (existing) {
          return this.lessonOrchestrator.toEnrichedRecord(existing);
        }
      }

      bootstrapSecondInstance = seriesMeta.bootstrapSecondInstance;
      payloadInput = {
        ...payloadInput,
        is_recurring: true,
        recurring_group_id: seriesMeta.recurringGroupId,
        recurrence_series_id: seriesMeta.recurrenceSeriesId,
        recurrence_index: seriesMeta.recurrenceIndex,
      };

      const saved = await this.lessonOrchestrator.persistLessonWithBooking(
        payloadInput,
        studentIds,
        materialIds,
        manager,
      );

      if (bootstrapSecondInstance) {
        const occupied = await this.lessonSeries.isSeriesInstanceOccupied(
          String(payloadInput.recurrence_series_id),
          bootstrapSecondInstance.recurrenceIndex,
          String(saved.teacherId),
          bootstrapSecondInstance.date,
          saved.scheduleSlotId,
          manager,
        );

        if (!occupied) {
          const secondPayload: Record<string, unknown> = {
            ...payloadInput,
            id: randomUUID(),
            date: bootstrapSecondInstance.date,
            recurrence_index: bootstrapSecondInstance.recurrenceIndex,
          };
          await this.lessonOrchestrator.persistLessonWithBooking(
            secondPayload,
            studentIds,
            materialIds,
            manager,
          );
        }
      }

      const refreshed = await manager.getRepository(LessonEntity).findOne({
        where: { id: saved.id },
      });
      return this.lessonOrchestrator.toEnrichedRecord((refreshed ?? saved) as LessonEntity);
    });
  }

  async updateLessonSeries(
    id: string,
    input: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const repo = this.dataSource.getRepository(LessonSeriesEntity);
    const managedRow = await repo.findOne({ where: { id } });
    if (!managedRow) {
      throw new NotFoundException('LessonSeries not found');
    }

    const allowed = new Set(['status', 'repeat_weekly', 'repeatWeekly']);
    for (const key of Object.keys(input)) {
      if (!allowed.has(key)) {
        throw new ForbiddenException(
          `LessonSeries field "${key}" cannot be updated directly`,
        );
      }
    }

    const payload = recordToEntityPayload(input);
    if (payload.status !== undefined) {
      managedRow.status = String(payload.status) as 'active' | 'paused' | 'stopped';
    }
    if (payload.repeatWeekly !== undefined) {
      managedRow.repeatWeekly = Boolean(payload.repeatWeekly);
    }

    if (managedRow.status === 'stopped') {
      managedRow.repeatWeekly = false;
    }

    managedRow.updatedDate = new Date();
    const saved = await repo.save(managedRow);
    const record = entityToRecord(saved as unknown as Record<string, unknown>);
    return (await this.enrichment.enrich('LessonSeries', [record]))[0];
  }

  async maintainActiveSeries(): Promise<{ created: number; skipped: number }> {
    const activeSeries = await this.dataSource.getRepository(LessonSeriesEntity).find({
      where: { status: 'active', repeatWeekly: true },
    });

    let created = 0;
    let skipped = 0;

    for (const seriesSummary of activeSeries) {
      const outcome = await this.dataSource.transaction(async (manager) => {
        const series = await manager
          .getRepository(LessonSeriesEntity)
          .createQueryBuilder('s')
          .setLock('pessimistic_write')
          .where('s.id = :id', { id: seriesSummary.id })
          .getOne();

        if (!series) {
          return 'skipped' as const;
        }

        const planned = await this.lessonSeries.planNextScheduledInstance(series, manager);
        if (!planned) {
          return 'skipped' as const;
        }

        await this.lessonOrchestrator.createLessonWithManager(
          planned.payload,
          SYSTEM_CONTEXT,
          manager,
        );
        return 'created' as const;
      });

      if (outcome === 'created') {
        created++;
      } else {
        skipped++;
      }
    }

    return { created, skipped };
  }
}
