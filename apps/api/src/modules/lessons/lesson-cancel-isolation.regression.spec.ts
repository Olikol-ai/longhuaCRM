/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ConflictException } from '@nestjs/common';

type LessonRow = {
  id: string;
  status: string;
  teacherId: string;
  groupId: string | null;
  recurrenceSeriesId: string | null;
  date: string;
};

/**
 * Exact-id isolation: cancelling one lesson must never mutate same-day /
 * same-teacher / same-group / same-series siblings unless applyScope fans out.
 */
describe('lesson cancel exact-id isolation', () => {
  function seedLessons(): LessonRow[] {
    return [
      {
        id: 'lesson-1',
        status: 'planned',
        teacherId: 'teacher-a',
        groupId: 'group-1',
        recurrenceSeriesId: 'series-a',
        date: '2026-08-15',
      },
      {
        id: 'lesson-2',
        status: 'planned',
        teacherId: 'teacher-a',
        groupId: null,
        recurrenceSeriesId: 'series-a',
        date: '2026-08-22',
      },
      {
        id: 'lesson-3',
        status: 'planned',
        teacherId: 'teacher-b',
        groupId: 'group-1',
        recurrenceSeriesId: 'series-b',
        date: '2026-08-15',
      },
      {
        id: 'lesson-4',
        status: 'planned',
        teacherId: 'teacher-b',
        groupId: null,
        recurrenceSeriesId: null,
        date: '2026-08-15',
      },
      {
        id: 'lesson-5',
        status: 'planned',
        teacherId: 'teacher-a',
        groupId: 'group-1',
        recurrenceSeriesId: 'series-a',
        date: '2026-08-29',
      },
    ];
  }

  function buildHarness(lessons: LessonRow[]) {
    const byId = () => new Map(lessons.map((row) => [row.id, row]));

    const cancelExact = async (id: string | undefined | null) => {
      if (typeof id !== 'string' || !id.trim()) {
        throw new BadRequestException('lessonId is required for cancel');
      }
      const lessonId = id.trim();
      const row = byId().get(lessonId);
      if (!row) throw new Error('not found');
      if (row.status === 'cancelled') {
        return { affectedRows: 0, lesson: row };
      }
      if (row.status !== 'planned') {
        throw new ConflictException('only planned');
      }

      const criteria = { id: lessonId };
      if (!criteria.id) {
        throw new ConflictException('empty criteria refused');
      }
      const matched = lessons.filter((item) => item.id === criteria.id);
      if (matched.length !== 1) {
        throw new ConflictException(
          `lesson.cancel aborted: expected exactly 1 affected row, got ${matched.length}`,
        );
      }
      matched[0].status = 'cancelled';
      return { affectedRows: 1, lesson: matched[0] };
    };

    /**
     * Models LessonsService.cancelWithScope: this → exact id;
     * all/series → all planned siblings in the same series (atomic in-memory).
     */
    const cancelWithScope = async (
      lessonId: string,
      applyScope: 'this' | 'following' | 'all' | 'series',
      opts?: { failMidway?: boolean; allowedSeriesIds?: Set<string> },
    ) => {
      const scope =
        applyScope === 'series' || applyScope === 'all'
          ? 'all'
          : applyScope === 'following'
            ? 'following'
            : 'this';

      if (scope === 'this') {
        return cancelExact(lessonId);
      }

      const anchor = byId().get(lessonId);
      if (!anchor?.recurrenceSeriesId) {
        return cancelExact(lessonId);
      }

      if (
        opts?.allowedSeriesIds &&
        !opts.allowedSeriesIds.has(anchor.recurrenceSeriesId)
      ) {
        throw new BadRequestException('unauthorized series');
      }

      const targets = lessons.filter((row) => {
        if (row.recurrenceSeriesId !== anchor.recurrenceSeriesId) return false;
        if (row.status !== 'planned') return false;
        if (scope === 'following' && row.date < anchor.date) return false;
        return true;
      });

      // Atomic: stage then commit, or roll back on failure.
      const snapshot = targets.map((row) => ({ id: row.id, status: row.status }));
      try {
        for (let i = 0; i < targets.length; i += 1) {
          if (opts?.failMidway && i === 1) {
            throw new ConflictException('simulated midway failure');
          }
          targets[i].status = 'cancelled';
        }
      } catch (error) {
        for (const snap of snapshot) {
          const row = byId().get(snap.id);
          if (row) row.status = snap.status;
        }
        throw error;
      }

      return { affectedRows: targets.length, lesson: anchor };
    };

    return { cancelExact, cancelWithScope, lessons };
  }

  it('cancels only the exact lesson id', async () => {
    const lessons = seedLessons();
    const h = buildHarness(lessons);
    await h.cancelExact('lesson-1');
    expect(lessons.find((l) => l.id === 'lesson-1')?.status).toBe('cancelled');
    expect(lessons.filter((l) => l.status === 'cancelled')).toHaveLength(1);
  });

  it('refuses empty lesson id', async () => {
    const h = buildHarness(seedLessons());
    await expect(h.cancelExact('')).rejects.toBeInstanceOf(BadRequestException);
    await expect(h.cancelExact(null)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('applyScope=this cancel mutates only the target lesson', async () => {
    const lessons = seedLessons();
    const h = buildHarness(lessons);
    await h.cancelWithScope('lesson-1', 'this');
    expect(lessons.find((l) => l.id === 'lesson-1')?.status).toBe('cancelled');
    expect(lessons.find((l) => l.id === 'lesson-2')?.status).toBe('planned');
    expect(lessons.find((l) => l.id === 'lesson-5')?.status).toBe('planned');
  });

  it('applyScope=all/series cancel mutates all planned series lessons', async () => {
    const lessons = seedLessons();
    const h = buildHarness(lessons);
    await h.cancelWithScope('lesson-1', 'series');
    expect(lessons.find((l) => l.id === 'lesson-1')?.status).toBe('cancelled');
    expect(lessons.find((l) => l.id === 'lesson-2')?.status).toBe('cancelled');
    expect(lessons.find((l) => l.id === 'lesson-5')?.status).toBe('cancelled');
    expect(lessons.find((l) => l.id === 'lesson-3')?.status).toBe('planned');
    expect(lessons.find((l) => l.id === 'lesson-4')?.status).toBe('planned');
  });

  it('applyScope=following cancel mutates from anchor date onward', async () => {
    const lessons = seedLessons();
    const h = buildHarness(lessons);
    await h.cancelWithScope('lesson-2', 'following');
    expect(lessons.find((l) => l.id === 'lesson-1')?.status).toBe('planned');
    expect(lessons.find((l) => l.id === 'lesson-2')?.status).toBe('cancelled');
    expect(lessons.find((l) => l.id === 'lesson-5')?.status).toBe('cancelled');
  });

  it('rolls back series cancel on midway failure (no partial cancel)', async () => {
    const lessons = seedLessons();
    const h = buildHarness(lessons);
    await expect(
      h.cancelWithScope('lesson-1', 'all', { failMidway: true }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(lessons.filter((l) => l.recurrenceSeriesId === 'series-a').every((l) => l.status === 'planned')).toBe(
      true,
    );
  });

  it('unauthorized actor cannot cancel a foreign series', async () => {
    const lessons = seedLessons();
    const h = buildHarness(lessons);
    await expect(
      h.cancelWithScope('lesson-1', 'all', {
        allowedSeriesIds: new Set(['series-b']),
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(lessons.every((l) => l.status === 'planned')).toBe(true);
  });
});
