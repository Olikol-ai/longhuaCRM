/** @jest-environment node */
/**
 * Regression: after DELETE /lessons/:id/future the recurrence series must be
 * stopped (status + untilDate) under the series lock, exceptions recorded, and
 * fillHorizon must not recreate planned occurrences.
 */
describe('lesson delete future stops recurrence regeneration', () => {
  it('fillHorizonCore returns 0 when series was stopped after list load (stale object)', async () => {
    const { LessonRecurrenceService } = await import('./lesson-recurrence.service');

    const seriesRow = {
      id: 'series-1',
      status: 'active',
      startDate: '2099-03-02',
      untilDate: null,
      weekday: 0,
      startTime: '18:00:00',
      duration: 60,
    };

    const seriesRepo = {
      findOne: jest.fn(async () => ({ ...seriesRow, status: 'stopped', untilDate: '2099-03-15' })),
    };
    const lessonRepo = {
      find: jest.fn(),
    };
    const exceptions = {
      listSkippedDates: jest.fn(async () => []),
      hasSkippedDate: jest.fn(async () => false),
      withSeriesLock: jest.fn(async (_id: string, work: () => Promise<unknown>) => work()),
    };

    const svc = Object.create(LessonRecurrenceService.prototype) as InstanceType<
      typeof LessonRecurrenceService
    >;
    Object.assign(svc, {
      seriesRepo,
      lessonRepo,
      exceptions,
      logger: { warn: jest.fn(), log: jest.fn(), error: jest.fn() },
      todayInMinsk: () => '2099-03-01',
      addDays: (d: string, n: number) => {
        const dt = new Date(`${d}T00:00:00Z`);
        dt.setUTCDate(dt.getUTCDate() + n);
        return dt.toISOString().slice(0, 10);
      },
      firstWeekdayOnOrAfter: (d: string) => d,
      createOccurrence: jest.fn(),
    });

    const created = await (svc as any).fillHorizonCore(null, { ...seriesRow }, '2099-03-01');
    expect(created).toBe(0);
    expect(seriesRepo.findOne).toHaveBeenCalledWith({ where: { id: 'series-1' } });
    expect((svc as any).createOccurrence).not.toHaveBeenCalled();
  });

  it('deleteStudentFutureFrom stops series, sets untilDate, and records exceptions', async () => {
    const { LessonsService } = await import('./lessons.service');

    const anchor = {
      id: 'w3',
      date: '2099-03-16',
      startTime: '18:00:00',
      status: 'planned',
      recurrenceSeriesId: 'series-1',
      primaryStudentId: 'stu-1',
      primaryTutorStudentId: null,
      primaryTeacherStudentContactId: null,
    };
    const lessons = [
      {
        id: 'w1',
        date: '2099-03-02',
        startTime: '18:00:00',
        status: 'completed',
        recurrenceSeriesId: 'series-1',
      },
      {
        id: 'w2',
        date: '2099-03-09',
        startTime: '18:00:00',
        status: 'completed',
        recurrenceSeriesId: 'series-1',
      },
      anchor,
      {
        id: 'w4',
        date: '2099-03-23',
        startTime: '18:00:00',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
      },
      {
        id: 'w5',
        date: '2099-03-30',
        startTime: '18:00:00',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
      },
      {
        id: 'w6',
        date: '2099-04-06',
        startTime: '18:00:00',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
      },
    ];
    const series = {
      id: 'series-1',
      status: 'active',
      untilDate: null,
      primaryStudentId: 'stu-1',
    };

    const markSkipped = jest.fn(async () => undefined);
    const lessonAccess = {
      assertCanWriteLesson: jest.fn(async () => undefined),
    };
    const audit = { log: jest.fn(async () => undefined) };

    const service = Object.create(LessonsService.prototype) as InstanceType<
      typeof LessonsService
    >;
    Object.assign(service, {
      lessonAccess,
      audit,
      logger: { log: jest.fn(), warn: jest.fn() },
      repository: {
        findById: jest.fn(async (id: string) => lessons.find((l) => l.id === id) ?? null),
      },
      recurrenceExceptions: {
        withSeriesLock: jest.fn(async (_id: string, work: () => Promise<unknown>) => work()),
        markSkipped,
      },
      dataSource: {
        getRepository: () => ({
          find: jest.fn(async () => [...lessons]),
        }),
        transaction: async (fn: (m: unknown) => Promise<unknown>) => {
          const manager = {
            getRepository: (entity: { name?: string }) => {
              const name = entity?.name || String(entity);
              if (name.includes('LessonRecurrenceSeries')) {
                return {
                  findOne: async () => series,
                  save: async (row: typeof series) => {
                    Object.assign(series, row);
                    return row;
                  },
                };
              }
              return {
                find: async () => [...lessons],
                delete: async ({ id }: { id: string }) => {
                  const idx = lessons.findIndex((l) => l.id === id);
                  if (idx < 0) return { affected: 0 };
                  lessons.splice(idx, 1);
                  return { affected: 1 };
                },
              };
            },
          };
          return fn(manager);
        },
      },
    });

    (service as any).normalizeLessonClock =
      LessonsService.prototype['normalizeLessonClock'].bind(service);
    (service as any).dayBeforeIsoDate =
      LessonsService.prototype['dayBeforeIsoDate'].bind(service);
    (service as any).filterSeriesDeleteTargets =
      LessonsService.prototype['filterSeriesDeleteTargets'].bind(service);
    (service as any).planSeriesOrPupilFutureDelete =
      LessonsService.prototype['planSeriesOrPupilFutureDelete'].bind(service);
    (service as any).executeSeriesOrPupilDelete =
      LessonsService.prototype['executeSeriesOrPupilDelete'].bind(service);
    service.deleteStudentFutureFrom =
      LessonsService.prototype.deleteStudentFutureFrom.bind(service);

    const actor = { sub: 'admin', role: 'admin', email: 'a@t' };
    const result = await service.deleteStudentFutureFrom(actor as never, 'w3');

    expect(result.deletedCount).toBe(4);
    expect(result.seriesStopped).toBe(true);
    expect(series.status).toBe('stopped');
    expect(series.untilDate).toBe('2099-03-15');
    expect(lessons.map((l) => l.id).sort()).toEqual(['w1', 'w2']);
    expect(markSkipped).toHaveBeenCalled();
    expect(markSkipped.mock.calls.length).toBeGreaterThanOrEqual(3);
  });
});
