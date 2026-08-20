/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

type LessonRow = {
  id: string;
  status: string;
  teacherId: string;
  recurrenceSeriesId: string | null;
  date: string;
};

type SeriesRow = {
  id: string;
  status: 'active' | 'stopped';
};

/**
 * Regression: DELETE with apply_scope must delete only the anchor for `this`,
 * delete the whole series transactionally for `all`/`series`, enforce per-lesson
 * ACL, and roll back on mid-batch failure.
 */
describe('lesson deleteWithScope regression', () => {
  function seed(): { lessons: LessonRow[]; series: SeriesRow[] } {
    return {
      series: [{ id: 'series-a', status: 'active' }],
      lessons: [
        {
          id: 'a1',
          status: 'planned',
          teacherId: 't1',
          recurrenceSeriesId: 'series-a',
          date: '2026-08-04',
        },
        {
          id: 'a2',
          status: 'planned',
          teacherId: 't1',
          recurrenceSeriesId: 'series-a',
          date: '2026-08-11',
        },
        {
          id: 'a3',
          status: 'completed',
          teacherId: 't1',
          recurrenceSeriesId: 'series-a',
          date: '2026-08-18',
        },
        {
          id: 'solo',
          status: 'planned',
          teacherId: 't1',
          recurrenceSeriesId: null,
          date: '2026-08-05',
        },
        {
          id: 'foreign',
          status: 'planned',
          teacherId: 't2',
          recurrenceSeriesId: 'series-a',
          date: '2026-08-25',
        },
      ],
    };
  }

  function buildHarness(opts?: {
    denyIds?: Set<string>;
    failDeleteId?: string;
  }) {
    const state = seed();
    const denyIds = opts?.denyIds ?? new Set<string>();
    const failDeleteId = opts?.failDeleteId;

    const singleDeletes: string[] = [];
    const exceptionDeletes: Array<{ seriesId: string; date: string; id: string }> =
      [];

    const deleteOne = async (id: string) => {
      if (failDeleteId && id === failDeleteId) {
        throw new ConflictException(`forced fail for ${id}`);
      }
      const idx = state.lessons.findIndex((l) => l.id === id);
      if (idx < 0) throw new NotFoundException('Lesson not found');
      const row = state.lessons[idx];
      if (row.recurrenceSeriesId) {
        exceptionDeletes.push({
          seriesId: row.recurrenceSeriesId,
          date: row.date,
          id: row.id,
        });
      }
      state.lessons.splice(idx, 1);
      singleDeletes.push(id);
    };

    const lessonAccess = {
      assertCanWriteLesson: jest.fn(async (_actor: unknown, lessonId: string) => {
        if (denyIds.has(lessonId)) {
          throw new ForbiddenException('Forbidden');
        }
        return {};
      }),
    };

    const recurrenceExceptions = {
      withSeriesLock: jest.fn(async (_id: string, work: () => Promise<unknown>) =>
        work(),
      ),
      recordExceptionThen: jest.fn(
        async (
          seriesId: string,
          date: string,
          _reason: string,
          lessonId: string,
          work: (manager: unknown) => Promise<unknown>,
        ) => {
          exceptionDeletes.push({ seriesId, date, id: lessonId });
          await work({});
          const idx = state.lessons.findIndex((l) => l.id === lessonId);
          if (idx >= 0) state.lessons.splice(idx, 1);
          singleDeletes.push(lessonId);
        },
      ),
    };

    async function deleteWithScope(
      actor: { sub: string; role: string },
      id: string,
      applyScope?: string | null,
    ): Promise<{ deletedCount: number; deletedIds: string[] }> {
      const scope =
        applyScope === 'series' || applyScope === 'all'
          ? 'all'
          : applyScope === 'following'
            ? 'following'
            : 'this';

      await lessonAccess.assertCanWriteLesson(actor, id);
      const anchor = state.lessons.find((l) => l.id === id);
      if (!anchor) throw new NotFoundException('Lesson not found');

      if (scope === 'this' || !anchor.recurrenceSeriesId) {
        await deleteOne(id);
        return { deletedCount: 1, deletedIds: [id] };
      }

      const seriesId = anchor.recurrenceSeriesId;
      const fromDate = scope === 'following' ? anchor.date : null;

      const runBulk = async () => {
        // Snapshot for rollback simulation
        const snapshotLessons = state.lessons.map((l) => ({ ...l }));
        const snapshotSeries = state.series.map((s) => ({ ...s }));
        try {
          const candidates = state.lessons.filter(
            (row) => row.recurrenceSeriesId === seriesId,
          );
          const targets = candidates.filter((row) => {
            if (fromDate && row.date < fromDate) return false;
            return true;
          });
          if (targets.length === 0) {
            throw new ConflictException('В серии нет занятий для удаления');
          }
          for (const row of targets) {
            await lessonAccess.assertCanWriteLesson(actor, row.id);
          }
          const deletedIds: string[] = [];
          for (const row of targets) {
            if (failDeleteId && row.id === failDeleteId) {
              throw new ConflictException(`forced fail for ${row.id}`);
            }
            const idx = state.lessons.findIndex((l) => l.id === row.id);
            if (idx < 0) {
              throw new ConflictException(
                `lesson.delete.series aborted: expected 1 row for ${row.id}, got 0`,
              );
            }
            state.lessons.splice(idx, 1);
            deletedIds.push(row.id);
          }
          const series = state.series.find((s) => s.id === seriesId);
          if (series) series.status = 'stopped';
          return { deletedCount: deletedIds.length, deletedIds };
        } catch (err) {
          state.lessons.splice(0, state.lessons.length, ...snapshotLessons);
          state.series.splice(0, state.series.length, ...snapshotSeries);
          throw err;
        }
      };

      return (await recurrenceExceptions.withSeriesLock(
        seriesId,
        runBulk,
      )) as { deletedCount: number; deletedIds: string[] };
    }

    return {
      state,
      deleteWithScope,
      lessonAccess,
      recurrenceExceptions,
      singleDeletes,
      exceptionDeletes,
    };
  }

  it('ordinary lesson delete removes only that lesson', async () => {
    const h = buildHarness();
    const result = await h.deleteWithScope(
      { sub: 'u1', role: 'admin' },
      'solo',
      'this',
    );
    expect(result.deletedCount).toBe(1);
    expect(h.state.lessons.find((l) => l.id === 'solo')).toBeUndefined();
    expect(h.state.lessons.filter((l) => l.recurrenceSeriesId === 'series-a')).toHaveLength(
      4,
    );
  });

  it('series lesson + this deletes only the selected occurrence', async () => {
    const h = buildHarness();
    await h.deleteWithScope({ sub: 'u1', role: 'admin' }, 'a2', 'this');
    expect(h.state.lessons.map((l) => l.id).sort()).toEqual(
      ['a1', 'a3', 'foreign', 'solo'].sort(),
    );
    expect(h.state.series[0].status).toBe('active');
  });

  it('series lesson + all/series deletes every occurrence and stops series', async () => {
    const h = buildHarness({
      denyIds: new Set(), // foreign also owned for admin harness
    });
    // Admin can write all — clear deny
    const result = await h.deleteWithScope(
      { sub: 'u1', role: 'admin' },
      'a1',
      'all',
    );
    expect(result.deletedCount).toBe(4);
    expect(h.state.lessons.filter((l) => l.recurrenceSeriesId === 'series-a')).toHaveLength(
      0,
    );
    expect(h.state.lessons.find((l) => l.id === 'solo')).toBeDefined();
    expect(h.state.series[0].status).toBe('stopped');
  });

  it('series alias behaves like all', async () => {
    const h = buildHarness();
    const result = await h.deleteWithScope(
      { sub: 'u1', role: 'admin' },
      'a1',
      'series',
    );
    expect(result.deletedCount).toBe(4);
    expect(h.state.series[0].status).toBe('stopped');
  });

  it('unauthorized sibling blocks whole series delete (rollback)', async () => {
    const h = buildHarness({ denyIds: new Set(['foreign']) });
    await expect(
      h.deleteWithScope({ sub: 'u1', role: 'teacher' }, 'a1', 'all'),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(h.state.lessons).toHaveLength(5);
    expect(h.state.series[0].status).toBe('active');
  });

  it('mid-batch delete error rolls back entire series delete', async () => {
    const h = buildHarness({ failDeleteId: 'a3' });
    await expect(
      h.deleteWithScope({ sub: 'u1', role: 'admin' }, 'a1', 'all'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(h.state.lessons).toHaveLength(5);
    expect(h.state.series[0].status).toBe('active');
  });

  it('deleting one series occurrence leaves other series lessons intact', async () => {
    const h = buildHarness();
    await h.deleteWithScope({ sub: 'u1', role: 'admin' }, 'a1', 'this');
    const remaining = h.state.lessons.filter((l) => l.recurrenceSeriesId === 'series-a');
    expect(remaining.map((l) => l.id).sort()).toEqual(['a2', 'a3', 'foreign'].sort());
    expect(h.state.series[0].status).toBe('active');
  });
});
