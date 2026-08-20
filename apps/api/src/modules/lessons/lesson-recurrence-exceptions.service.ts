import { Injectable } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import {
  LessonRecurrenceExceptionEntity,
  LessonRecurrenceExceptionReason,
} from './entities/lesson-recurrence-exception.entity';

/**
 * Stable int4 pair for PostgreSQL advisory locks on a recurrence series.
 * Serializes fillHorizon vs single-occurrence mutate (reschedule/cancel/delete).
 */
export function recurrenceSeriesLockKeys(seriesId: string): [number, number] {
  let h1 = 0x6c687265; // "lhre"
  let h2 = 0x73657269; // "seri"
  for (let i = 0; i < seriesId.length; i += 1) {
    const c = seriesId.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619);
    h2 = Math.imul(h2 ^ seriesId.charCodeAt(seriesId.length - 1 - i), 2246822519);
  }
  return [h1 | 0, h2 | 0];
}

/**
 * Persists per-date exceptions for rolling weekly recurrence series.
 * fillHorizon must never recreate a date that appears here.
 *
 * Mutating a single occurrence and extending the horizon both take the same
 * series advisory lock so a concurrent cron cannot insert a ghost planned row
 * into the gap between "lesson moved" and "exception committed".
 */
@Injectable()
export class LessonRecurrenceExceptionsService {
  constructor(
    @InjectRepository(LessonRecurrenceExceptionEntity)
    private readonly repo: Repository<LessonRecurrenceExceptionEntity>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Exclusive series critical section (session-level advisory lock).
   * Lock and unlock MUST run on the same PostgreSQL session. TypeORM's
   * `dataSource.query()` borrows a pooled connection per call, so unlocking
   * on a different connection leaves the lock held forever and the next
   * cancel/fillHorizon for that series hangs until the HTTP layer returns 500.
   */
  async withSeriesLock<T>(
    recurrenceSeriesId: string,
    work: () => Promise<T>,
  ): Promise<T> {
    if (!recurrenceSeriesId) {
      return work();
    }
    const [k1, k2] = recurrenceSeriesLockKeys(recurrenceSeriesId);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    try {
      await runner.query('SELECT pg_advisory_lock($1::int, $2::int)', [k1, k2]);
      try {
        return await work();
      } finally {
        await runner.query('SELECT pg_advisory_unlock($1::int, $2::int)', [
          k1,
          k2,
        ]);
      }
    } finally {
      await runner.release();
    }
  }

  private repoFor(manager?: EntityManager): Repository<LessonRecurrenceExceptionEntity> {
    return manager
      ? manager.getRepository(LessonRecurrenceExceptionEntity)
      : this.repo;
  }

  async markSkipped(
    recurrenceSeriesId: string,
    originalDate: string | Date,
    reason: LessonRecurrenceExceptionReason,
    lessonId?: string | null,
    manager?: EntityManager,
  ): Promise<void> {
    if (!recurrenceSeriesId || !originalDate) return;
    // Prefer calendar date string; never use toISOString() (UTC shift can move the day).
    let dateOnly: string;
    if (originalDate instanceof Date) {
      const y = originalDate.getFullYear();
      const m = String(originalDate.getMonth() + 1).padStart(2, '0');
      const d = String(originalDate.getDate()).padStart(2, '0');
      dateOnly = `${y}-${m}-${d}`;
    } else {
      dateOnly = String(originalDate).slice(0, 10);
    }
    const repo = this.repoFor(manager);

    const existing = await repo.findOne({
      where: { recurrenceSeriesId, originalDate: dateOnly },
    });
    if (existing) {
      let dirty = false;
      if (lessonId && existing.lessonId !== lessonId) {
        existing.lessonId = lessonId;
        dirty = true;
      }
      if (reason === 'rescheduled' && existing.reason !== 'rescheduled') {
        existing.reason = reason;
        dirty = true;
      }
      if (reason === 'cancelled' && existing.reason !== 'cancelled' && existing.reason !== 'rescheduled') {
        existing.reason = reason;
        dirty = true;
      }
      if (dirty) {
        await repo.save(existing);
      }
      return;
    }

    await repo.save(
      repo.create({
        recurrenceSeriesId,
        originalDate: dateOnly,
        reason,
        lessonId: lessonId ?? null,
      }),
    );
  }

  /**
   * Atomically record an exception and run follow-up writes (e.g. move/delete)
   * under the series advisory lock so fillHorizon cannot observe a gap.
   */
  async recordExceptionThen<T>(
    recurrenceSeriesId: string,
    originalDate: string,
    reason: LessonRecurrenceExceptionReason,
    lessonId: string | null | undefined,
    work: (manager: EntityManager) => Promise<T>,
  ): Promise<T> {
    return this.withSeriesLock(recurrenceSeriesId, async () =>
      this.dataSource.transaction(async (manager) => {
        await this.markSkipped(
          recurrenceSeriesId,
          originalDate,
          reason,
          lessonId,
          manager,
        );
        return work(manager);
      }),
    );
  }

  async listSkippedDates(
    recurrenceSeriesId: string,
    manager?: EntityManager,
  ): Promise<Set<string>> {
    if (!recurrenceSeriesId) return new Set();
    const repo = this.repoFor(manager);
    const rows = await repo.find({
      where: { recurrenceSeriesId },
      select: ['originalDate'],
    });
    return new Set(rows.map((row) => row.originalDate));
  }

  async hasSkippedDate(
    recurrenceSeriesId: string,
    originalDate: string,
    manager?: EntityManager,
  ): Promise<boolean> {
    if (!recurrenceSeriesId || !originalDate) return false;
    const repo = this.repoFor(manager);
    const row = await repo.findOne({
      where: { recurrenceSeriesId, originalDate },
      select: ['id'],
    });
    return Boolean(row);
  }
}
