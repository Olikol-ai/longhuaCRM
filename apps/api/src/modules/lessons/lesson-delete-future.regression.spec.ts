/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { LessonsService } from './lessons.service';

describe('deleteStudentFutureFrom / deleteSeriesPlannedFrom', () => {
  function seed() {
    return {
      lessons: [
        {
          id: 'past-1',
          status: 'completed',
          primaryStudentId: 'stu-1',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-02',
          startTime: '10:00:00',
          recurrenceSeriesId: 'series-a',
        },
        {
          id: 'past-2',
          status: 'completed',
          primaryStudentId: 'stu-1',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-09',
          startTime: '10:00:00',
          recurrenceSeriesId: 'series-a',
        },
        {
          id: 'anchor',
          status: 'planned',
          primaryStudentId: 'stu-1',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-16',
          startTime: '10:00:00',
          recurrenceSeriesId: 'series-a',
        },
        {
          id: 'future-1',
          status: 'planned',
          primaryStudentId: 'stu-1',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-23',
          startTime: '10:00:00',
          recurrenceSeriesId: 'series-a',
        },
        {
          id: 'future-2',
          status: 'planned',
          primaryStudentId: 'stu-1',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-30',
          startTime: '10:00:00',
          recurrenceSeriesId: 'series-a',
        },
        {
          id: 'other-series-future',
          status: 'planned',
          primaryStudentId: 'stu-1',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-24',
          startTime: '12:00:00',
          recurrenceSeriesId: 'series-b',
        },
        {
          id: 'other-student',
          status: 'planned',
          primaryStudentId: 'stu-2',
          primaryTutorStudentId: null,
          primaryTeacherStudentContactId: null,
          date: '2099-03-23',
          startTime: '10:00:00',
          recurrenceSeriesId: null,
        },
      ] as any[],
      series: [
        { id: 'series-a', status: 'active', untilDate: null as string | null, primaryStudentId: 'stu-1' },
        { id: 'series-b', status: 'active', untilDate: null as string | null, primaryStudentId: 'stu-1' },
      ],
    };
  }

  function buildService(state: ReturnType<typeof seed>, denyIds = new Set<string>()) {
    const markSkipped = jest.fn(async () => undefined);
    const service = Object.create(LessonsService.prototype) as LessonsService;
    Object.assign(service, {
      lessonAccess: {
        assertCanWriteLesson: jest.fn(async (_a: unknown, id: string) => {
          if (denyIds.has(id)) throw new ForbiddenException('no');
        }),
      },
      audit: { log: jest.fn(async () => undefined) },
      logger: { log: jest.fn(), warn: jest.fn() },
      repository: {
        findById: jest.fn(async (id: string) => state.lessons.find((l) => l.id === id) ?? null),
      },
      recurrenceExceptions: {
        withSeriesLock: jest.fn(async (_id: string, work: () => Promise<unknown>) => work()),
        markSkipped,
      },
      dataSource: {
        getRepository: () => ({
          find: async (opts: any) => {
            const sid = opts?.where?.recurrenceSeriesId;
            return state.lessons.filter((l) => l.recurrenceSeriesId === sid);
          },
        }),
        transaction: async (fn: (m: any) => Promise<unknown>) => {
          const manager = {
            getRepository: (entity: { name?: string }) => {
              const name = entity?.name || '';
              if (name.includes('LessonRecurrenceSeries')) {
                return {
                  findOne: async ({ where }: any) =>
                    state.series.find((s) => s.id === where.id) ?? null,
                  save: async (row: any) => {
                    const idx = state.series.findIndex((s) => s.id === row.id);
                    if (idx >= 0) state.series[idx] = row;
                    return row;
                  },
                };
              }
              return {
                find: async ({ where }: any) => {
                  let rows = state.lessons.filter(
                    (l) => l.recurrenceSeriesId === where.recurrenceSeriesId,
                  );
                  if (where.status) {
                    rows = rows.filter((l) => l.status === where.status);
                  }
                  return rows;
                },
                delete: async ({ id }: { id: string }) => {
                  const idx = state.lessons.findIndex((l) => l.id === id);
                  if (idx < 0) return { affected: 0 };
                  state.lessons.splice(idx, 1);
                  return { affected: 1 };
                },
              };
            },
          };
          return fn(manager);
        },
      },
    });

    for (const method of [
      'normalizeLessonClock',
      'dayBeforeIsoDate',
      'filterSeriesDeleteTargets',
      'planSeriesOrPupilFutureDelete',
      'executeSeriesOrPupilDelete',
      'resolveIndividualParticipant',
      'findPlannedLessonsFromParticipant',
      'previewStudentFutureDelete',
      'previewSeriesDelete',
      'deleteStudentFutureFrom',
      'deleteSeriesPlannedFrom',
    ] as const) {
      (service as any)[method] = (LessonsService.prototype as any)[method].bind(service);
    }

    return { service, markSkipped };
  }

  const actor = { sub: 'admin', role: 'admin', email: 'a@t' };

  it('future deletes only this series from anchor and stops it', async () => {
    const state = seed();
    const { service, markSkipped } = buildService(state);
    const result = await service.deleteStudentFutureFrom(actor as never, 'anchor');
    expect(result.deletedCount).toBe(3);
    expect(result.seriesStopped).toBe(true);
    expect(state.series.find((s) => s.id === 'series-a')?.status).toBe('stopped');
    expect(state.series.find((s) => s.id === 'series-a')?.untilDate).toBe('2099-03-15');
    expect(state.series.find((s) => s.id === 'series-b')?.status).toBe('active');
    expect(state.lessons.map((l) => l.id).sort()).toEqual(
      ['other-series-future', 'other-student', 'past-1', 'past-2'].sort(),
    );
    expect(markSkipped).toHaveBeenCalled();
  });

  it('series mode deletes all planned of the series including earlier planned', async () => {
    const state = seed();
    // Make past-2 planned so series mode removes it but keeps completed past-1
    state.lessons.find((l) => l.id === 'past-2')!.status = 'planned';
    const { service } = buildService(state);
    const result = await service.deleteSeriesPlannedFrom(actor as never, 'anchor');
    expect(result.seriesStopped).toBe(true);
    expect(state.lessons.map((l) => l.id).sort()).toEqual(
      ['other-series-future', 'other-student', 'past-1'].sort(),
    );
    expect(state.series.find((s) => s.id === 'series-a')?.status).toBe('stopped');
  });

  it('future also removes cancelled siblings of the same series (UI leftovers)', async () => {
    const state = seed();
    state.lessons.find((l) => l.id === 'future-1')!.status = 'cancelled';
    state.lessons.find((l) => l.id === 'future-2')!.status = 'cancelled';
    const { service } = buildService(state);
    const result = await service.deleteStudentFutureFrom(actor as never, 'anchor');
    expect(result.deletedCount).toBe(3);
    expect(state.lessons.map((l) => l.id).sort()).toEqual(
      ['other-series-future', 'other-student', 'past-1', 'past-2'].sort(),
    );
  });
});
