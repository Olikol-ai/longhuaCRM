import { LessonRecurrenceExceptionsService, recurrenceSeriesLockKeys } from './lesson-recurrence-exceptions.service';
import { LessonRecurrenceService } from './lesson-recurrence.service';

describe('LessonRecurrenceExceptionsService', () => {
  function buildService() {
    const store: Array<Record<string, unknown>> = [];
    const repo = {
      findOne: jest.fn(async ({ where }: { where: Record<string, string> }) =>
        store.find(
          (row) =>
            row.recurrenceSeriesId === where.recurrenceSeriesId &&
            row.originalDate === where.originalDate,
        ) ?? null,
      ),
      create: jest.fn((input: Record<string, unknown>) => ({ ...input })),
      save: jest.fn(async (row: Record<string, unknown>) => {
        const idx = store.findIndex(
          (item) =>
            item.recurrenceSeriesId === row.recurrenceSeriesId &&
            item.originalDate === row.originalDate,
        );
        if (idx >= 0) {
          store[idx] = { ...store[idx], ...row };
          return store[idx];
        }
        store.push(row);
        return row;
      }),
      find: jest.fn(async ({ where }: { where: { recurrenceSeriesId: string } }) =>
        store.filter((row) => row.recurrenceSeriesId === where.recurrenceSeriesId),
      ),
    };

    const runnerQuery = jest.fn(async () => [{ pg_advisory_lock: true }]);
    const runner = {
      connect: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      query: runnerQuery,
    };

    const dataSource = {
      query: jest.fn(async () => [{ pg_advisory_lock: true }]),
      createQueryRunner: jest.fn(() => runner),
      transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: () => repo,
        };
        return work(manager);
      }),
    };

    const svc = new LessonRecurrenceExceptionsService(
      repo as never,
      dataSource as never,
    );
    return { svc, store, dataSource, repo, runner, runnerQuery };
  }

  it('markSkipped inserts once and updates reason/lesson when needed', async () => {
    const { svc, store } = buildService();
    await svc.markSkipped('series-1', '2026-08-11', 'cancelled', 'lesson-1');
    await svc.markSkipped('series-1', '2026-08-11', 'rescheduled', 'lesson-1');

    expect(store).toHaveLength(1);
    expect(store[0]).toMatchObject({
      recurrenceSeriesId: 'series-1',
      originalDate: '2026-08-11',
      reason: 'rescheduled',
      lessonId: 'lesson-1',
    });

    const dates = await svc.listSkippedDates('series-1');
    expect(dates.has('2026-08-11')).toBe(true);
  });

  it('markSkipped normalizes Date originalDate to YYYY-MM-DD', async () => {
    const { svc, store } = buildService();
    await svc.markSkipped(
      'series-1',
      new Date('2026-08-15T00:00:00.000Z'),
      'cancelled',
      'lesson-1',
    );
    expect(store[0]).toMatchObject({
      originalDate: '2026-08-15',
      reason: 'cancelled',
    });
  });

  it('recordExceptionThen writes exception before follow-up work commits', async () => {
    const { svc, store, dataSource, runnerQuery } = buildService();
    const order: string[] = [];

    dataSource.transaction.mockImplementation(
      async (work: (manager: unknown) => Promise<unknown>) => {
        const manager = {
          getRepository: () => ({
            findOne: async ({ where }: { where: Record<string, string> }) =>
              store.find(
                (row) =>
                  row.recurrenceSeriesId === where.recurrenceSeriesId &&
                  row.originalDate === where.originalDate,
              ) ?? null,
            create: (input: Record<string, unknown>) => ({ ...input }),
            save: async (row: Record<string, unknown>) => {
              order.push('exception_saved');
              store.push(row);
              return row;
            },
            update: async () => {
              order.push('lesson_updated');
            },
          }),
        };
        return work(manager);
      },
    );

    await svc.recordExceptionThen(
      'series-1',
      '2026-08-11',
      'rescheduled',
      'lesson-1',
      async (manager) => {
        await manager.getRepository({} as never).update({} as never, {} as never);
      },
    );

    expect(order).toEqual(['exception_saved', 'lesson_updated']);
    expect(store[0]).toMatchObject({
      originalDate: '2026-08-11',
      reason: 'rescheduled',
    });
    expect(runnerQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_lock($1::int, $2::int)',
      recurrenceSeriesLockKeys('series-1'),
    );
    expect(runnerQuery).toHaveBeenCalledWith(
      'SELECT pg_advisory_unlock($1::int, $2::int)',
      recurrenceSeriesLockKeys('series-1'),
    );
  });

  it('withSeriesLock lock and unlock share one QueryRunner session', async () => {
    const { svc, runner, runnerQuery } = buildService();
    await svc.withSeriesLock('series-1', async () => 'ok');
    expect(runner.connect).toHaveBeenCalledTimes(1);
    expect(runner.release).toHaveBeenCalledTimes(1);
    const sqlCalls = (runnerQuery.mock.calls as unknown as unknown[][]).map(
      (call) => call[0],
    );
    expect(sqlCalls).toEqual([
      'SELECT pg_advisory_lock($1::int, $2::int)',
      'SELECT pg_advisory_unlock($1::int, $2::int)',
    ]);
    const calls = runnerQuery.mock.calls as unknown as unknown[][];
    expect(calls[0]?.[1]).toEqual(recurrenceSeriesLockKeys('series-1'));
    expect(calls[1]?.[1]).toEqual(recurrenceSeriesLockKeys('series-1'));
  });

  it('withSeriesLock serializes concurrent critical sections', async () => {
    const { svc, runner } = buildService();
    let active = 0;
    let maxActive = 0;
    const gate: Array<() => void> = [];

    (runner as { query: jest.Mock }).query = jest.fn(async (sql: string) => {
      if (String(sql).includes('pg_advisory_lock')) {
        await new Promise<void>((resolve) => {
          const run = () => resolve();
          if (gate.length === 0 && active === 0) {
            active += 1;
            maxActive = Math.max(maxActive, active);
            run();
          } else {
            gate.push(() => {
              active += 1;
              maxActive = Math.max(maxActive, active);
              run();
            });
          }
        });
        return [];
      }
      if (String(sql).includes('pg_advisory_unlock')) {
        active -= 1;
        const next = gate.shift();
        if (next) next();
        return [];
      }
      return [];
    });

    const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
    await Promise.all([
      svc.withSeriesLock('series-race', async () => {
        await sleep(40);
      }),
      svc.withSeriesLock('series-race', async () => {
        await sleep(40);
      }),
      svc.withSeriesLock('series-race', async () => {
        await sleep(40);
      }),
    ]);

    expect(maxActive).toBe(1);
  });
});

describe('LessonRecurrenceService.fillHorizon respects exceptions', () => {
  it('does not recreate a skipped original weekday after reschedule', async () => {
    const series = {
      id: 'series-1',
      status: 'active',
      weekday: 1, // Tuesday (Mon=0)
      startDate: '2026-08-04',
      startTime: '18:30',
      duration: 60,
      untilDate: '2026-08-25',
      teacherId: 't1',
      tutorId: null,
      groupId: null,
      primaryStudentId: 's1',
      primaryTutorStudentId: null,
      primaryTeacherStudentContactId: null,
      lessonType: 'individual',
      lessonFormat: 'online',
      meetingLink: null,
      room: null,
      notes: null,
    };

    // After move: original Tue 11 Aug lesson now lives on Wed 12 Aug.
    const lessons = [
      { id: 'moved', date: '2026-08-12', status: 'planned', recurrenceSeriesId: 'series-1' },
      { id: 'week1', date: '2026-08-04', status: 'planned', recurrenceSeriesId: 'series-1' },
      { id: 'week3', date: '2026-08-18', status: 'planned', recurrenceSeriesId: 'series-1' },
      { id: 'week4', date: '2026-08-25', status: 'planned', recurrenceSeriesId: 'series-1' },
    ];

    const createdDates: string[] = [];
    const lessonRepo = {
      find: jest.fn(async () => lessons),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      update: jest.fn(),
    };
    const seriesRepo = { find: jest.fn(), findOne: jest.fn(), save: jest.fn(), create: jest.fn(), delete: jest.fn() };
    const lessonsService = {
      create: jest.fn(async (_actor: unknown, dto: { date: string }) => {
        createdDates.push(dto.date);
        return { id: `new-${dto.date}`, date: dto.date };
      }),
    };
    const exceptions = {
      listSkippedDates: jest.fn(async () => new Set(['2026-08-11'])),
      hasSkippedDate: jest.fn(async () => false),
      markSkipped: jest.fn(),
      withSeriesLock: jest.fn(async (_id: string, work: () => Promise<unknown>) => work()),
      recordExceptionThen: jest.fn(),
    };

    const svc = new LessonRecurrenceService(
      seriesRepo as never,
      lessonRepo as never,
      lessonsService as never,
      exceptions as never,
      { assertCanWriteLesson: jest.fn() } as never,
    );

    // Freeze "today" before the series window so horizon walks the full range.
    jest.spyOn(svc as never, 'todayInMinsk' as never).mockReturnValue('2026-08-01' as never);

    const created = await svc.fillHorizon(null, series as never);
    expect(created).toBe(0);
    expect(createdDates).toEqual([]);
    expect(exceptions.listSkippedDates).toHaveBeenCalledWith('series-1');
    expect(exceptions.withSeriesLock).toHaveBeenCalledWith(
      'series-1',
      expect.any(Function),
    );
  });

  it('race: concurrent fillHorizon cannot create ghost after exception is recorded', async () => {
    const series = {
      id: 'series-race',
      status: 'active',
      weekday: 1,
      startDate: '2026-08-04',
      startTime: '18:30',
      duration: 60,
      untilDate: '2026-08-18',
      teacherId: 't1',
      tutorId: null,
      groupId: null,
      primaryStudentId: 's1',
      primaryTutorStudentId: null,
      primaryTeacherStudentContactId: null,
      lessonType: 'individual',
      lessonFormat: 'online',
      meetingLink: null,
      room: null,
      notes: null,
    };

    // Shared mutable state simulating DB under a real mutex (advisory lock).
    let lessons = [
      { id: 'L1', date: '2026-08-04', status: 'planned' },
      { id: 'L2', date: '2026-08-11', status: 'planned' },
      { id: 'L3', date: '2026-08-18', status: 'planned' },
    ];
    const skipped = new Set<string>();
    const createdDates: string[] = [];

    let lock: Promise<void> = Promise.resolve();
    const withSeriesLock = async (_id: string, work: () => Promise<unknown>) => {
      const prev = lock;
      let release!: () => void;
      lock = new Promise<void>((r) => {
        release = r;
      });
      await prev;
      try {
        return await work();
      } finally {
        release();
      }
    };

    const exceptions = {
      withSeriesLock: jest.fn(withSeriesLock),
      listSkippedDates: jest.fn(async () => new Set(skipped)),
      hasSkippedDate: jest.fn(async (_s: string, d: string) => skipped.has(d)),
      markSkipped: jest.fn(async (_s: string, d: string) => {
        skipped.add(d);
      }),
      recordExceptionThen: jest.fn(
        async (
          _s: string,
          d: string,
          _r: string,
          _l: string,
          work: (m: unknown) => Promise<unknown>,
        ) =>
          withSeriesLock('series-race', async () => {
            skipped.add(d);
            return work({});
          }),
      ),
    };

    const lessonRepo = {
      find: jest.fn(async () => lessons.map((row) => ({ ...row }))),
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      update: jest.fn(),
    };
    const seriesRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
    };
    const lessonsService = {
      create: jest.fn(async (_actor: unknown, dto: { date: string }) => {
        createdDates.push(dto.date);
        lessons = [...lessons, { id: `new-${dto.date}`, date: dto.date, status: 'planned' }];
        return { id: `new-${dto.date}`, date: dto.date };
      }),
    };

    const svc = new LessonRecurrenceService(
      seriesRepo as never,
      lessonRepo as never,
      lessonsService as never,
      exceptions as never,
      { assertCanWriteLesson: jest.fn() } as never,
    );
    jest.spyOn(svc as never, 'todayInMinsk' as never).mockReturnValue('2026-08-01' as never);

    const moveThenFill = async () => {
      await exceptions.recordExceptionThen(
        'series-race',
        '2026-08-11',
        'rescheduled',
        'L2',
        async () => {
          lessons = lessons.map((row) =>
            row.id === 'L2' ? { ...row, date: '2026-08-12' } : row,
          );
        },
      );
      await svc.fillHorizon(null, series as never);
    };

    const fillOnly = async () => {
      await svc.fillHorizon(null, series as never);
    };

    // Hammer concurrent move+fill vs bare fill many times.
    for (let i = 0; i < 12; i += 1) {
      createdDates.length = 0;
      lessons = [
        { id: 'L1', date: '2026-08-04', status: 'planned' },
        { id: 'L2', date: '2026-08-11', status: 'planned' },
        { id: 'L3', date: '2026-08-18', status: 'planned' },
      ];
      skipped.clear();

      await Promise.all([moveThenFill(), fillOnly(), fillOnly()]);

      expect(skipped.has('2026-08-11')).toBe(true);
      expect(createdDates).not.toContain('2026-08-11');
      expect(lessons.filter((row) => row.date === '2026-08-11' && row.status === 'planned')).toHaveLength(0);
    }
  });
});
