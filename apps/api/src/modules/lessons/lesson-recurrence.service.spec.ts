import { LessonRecurrenceService } from './lesson-recurrence.service';
import { ForbiddenException } from '@nestjs/common';

/** Exercise pure date helpers via a lightweight stub (no Nest DI). */
function makeHelpers() {
  const svc = Object.create(LessonRecurrenceService.prototype) as LessonRecurrenceService;
  return {
    weekdayFromDate: (d: string) => svc.weekdayFromDate(d),
    daysBetween: (from: string, to: string) => svc.daysBetween(from, to),
    addDays: (d: string, n: number) =>
      (svc as unknown as { addDays(dateStr: string, days: number): string }).addDays(d, n),
    firstWeekdayOnOrAfter: (d: string, wd: number) =>
      (
        svc as unknown as {
          firstWeekdayOnOrAfter(dateStr: string, weekday: number): string;
        }
      ).firstWeekdayOnOrAfter(d, wd),
  };
}

describe('LessonRecurrenceService date helpers', () => {
  const h = makeHelpers();

  it('weekdayFromDate uses Mon=0 … Sun=6 in UTC calendar dates', () => {
    expect(h.weekdayFromDate('2026-08-03')).toBe(0);
    expect(h.weekdayFromDate('2026-08-09')).toBe(6);
    expect(h.weekdayFromDate('2026-09-01')).toBe(1); // Tuesday
    expect(h.weekdayFromDate('2026-09-02')).toBe(2); // Wednesday
  });

  it('daysBetween counts signed calendar offset', () => {
    expect(h.daysBetween('2026-09-01', '2026-09-02')).toBe(1);
    expect(h.daysBetween('2026-12-31', '2027-01-01')).toBe(1);
  });

  it('addDays keeps ISO calendar arithmetic across month boundary', () => {
    expect(h.addDays('2026-08-29', 7)).toBe('2026-09-05');
    expect(h.addDays('2026-08-01', 7)).toBe('2026-08-08');
    expect(h.addDays('2026-09-01', 1)).toBe('2026-09-02');
  });

  it('firstWeekdayOnOrAfter finds next matching weekday', () => {
    expect(h.firstWeekdayOnOrAfter('2026-08-03', 0)).toBe('2026-08-03');
    expect(h.firstWeekdayOnOrAfter('2026-08-04', 0)).toBe('2026-08-10');
  });
});

describe('LessonRecurrenceService series fan-out', () => {
  function buildSvc(opts: {
    lessonsService: Record<string, unknown>;
    lessonAccess?: Record<string, unknown>;
    siblings?: Array<Record<string, unknown>>;
    dataSource?: Record<string, unknown>;
  }) {
    const lessonRepo = {
      findOne: jest.fn(async () => ({
        id: 'lesson-1',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
        date: '2026-08-15',
        startTime: '10:00',
      })),
      find: jest.fn(async () => opts.siblings ?? [
        {
          id: 'lesson-1',
          status: 'planned',
          recurrenceSeriesId: 'series-1',
          date: '2026-08-15',
        },
        {
          id: 'lesson-2',
          status: 'planned',
          recurrenceSeriesId: 'series-1',
          date: '2026-08-22',
        },
      ]),
      update: jest.fn(),
      save: jest.fn(),
    };
    const lessonRepoUpdates: Array<{ id: string; patch: unknown }> = [];
    const managerLessonRepo = {
      update: jest.fn(async (id: string, patch: unknown) => {
        lessonRepoUpdates.push({ id, patch });
      }),
      save: jest.fn(),
    };
    const seriesRepo = {
      findOne: jest.fn(async () => ({
        id: 'series-1',
        status: 'active',
        startTime: '10:00',
        duration: 60,
        teacherId: 't1',
        tutorId: null,
        groupId: null,
        primaryStudentId: 's1',
        primaryTutorStudentId: null,
        primaryTeacherStudentContactId: null,
        lessonFormat: 'online',
        meetingLink: null,
        room: null,
        notes: null,
        weekday: 5,
        startDate: '2026-08-15',
      })),
      save: jest.fn(async (row: unknown) => row),
      create: jest.fn(),
      find: jest.fn(),
      delete: jest.fn(),
    };
    const exceptions = {
      withSeriesLock: jest.fn(async (_id: string, work: () => Promise<unknown>) =>
        work(),
      ),
      listSkippedDates: jest.fn(async () => new Set()),
      hasSkippedDate: jest.fn(),
      recordExceptionThen: jest.fn(),
      markSkipped: jest.fn(),
    };
    const lessonAccess = opts.lessonAccess ?? {
      assertCanWriteLesson: jest.fn(async () => ({})),
    };
    const dataSource = opts.dataSource ?? {
      transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) =>
        work({
          getRepository: () => ({
            save: seriesRepo.save,
            update: managerLessonRepo.update,
          }),
        }),
      ),
    };

    const svc = new LessonRecurrenceService(
      seriesRepo as never,
      lessonRepo as never,
      opts.lessonsService as never,
      exceptions as never,
      lessonAccess as never,
      dataSource as never,
    );

    jest.spyOn(svc as never, 'fillHorizonCore' as never).mockResolvedValue(0 as never);

    return { svc, lessonRepoUpdates, managerLessonRepo };
  }

  it('routes cancelled + applyScope via cancelWithScope', async () => {
    const lessonsService = {
      cancelWithScope: jest.fn(async () => ({ id: 'lesson-1', status: 'cancelled' })),
      update: jest.fn(),
      findById: jest.fn(),
    };
    const { svc } = buildSvc({ lessonsService });

    await svc.applyLessonUpdateWithRecurrence(
      { sub: 'u1', role: 'teacher' } as never,
      'lesson-1',
      { status: 'cancelled' },
      { applyScope: 'all' },
    );

    expect(lessonsService.cancelWithScope).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'teacher' }),
      'lesson-1',
      'all',
    );
    expect(lessonsService.update).not.toHaveBeenCalled();
  });

  it('fans out non-status fields to all planned siblings for teacher', async () => {
    const lessonsService = {
      cancelWithScope: jest.fn(),
      update: jest.fn(async (_a: unknown, id: string) => ({ id, status: 'planned' })),
      findById: jest.fn(async () => ({ id: 'lesson-1', status: 'planned' })),
      assertOccurrenceRescheduleSlot: jest.fn(),
    };
    const lessonAccess = {
      assertCanWriteLesson: jest.fn(async () => ({ notes: 'hi' })),
    };
    const { svc, lessonRepoUpdates } = buildSvc({ lessonsService, lessonAccess });

    await svc.applyLessonUpdateWithRecurrence(
      { sub: 'u1', role: 'teacher' } as never,
      'lesson-1',
      { notes: 'hi', status: 'planned' },
      { applyScope: 'all' },
    );

    expect(lessonAccess.assertCanWriteLesson).toHaveBeenCalledTimes(2);
    expect(lessonRepoUpdates).toHaveLength(2);
    expect(lessonRepoUpdates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'lesson-1', patch: expect.objectContaining({ notes: 'hi' }) }),
        expect.objectContaining({ id: 'lesson-2', patch: expect.objectContaining({ notes: 'hi' }) }),
      ]),
    );
  });

  it('fans out status=completed across series when ACL allows', async () => {
    const lessonsService = {
      cancelWithScope: jest.fn(),
      update: jest.fn(async (_a: unknown, id: string) => ({
        id,
        status: 'completed',
      })),
      findById: jest.fn(async () => ({ id: 'lesson-1', status: 'completed' })),
      assertOccurrenceRescheduleSlot: jest.fn(),
    };
    const lessonAccess = {
      assertCanWriteLesson: jest.fn(async () => ({ status: 'completed' })),
    };
    const { svc, lessonRepoUpdates } = buildSvc({ lessonsService, lessonAccess });

    await svc.applyLessonUpdateWithRecurrence(
      { sub: 'u1', role: 'admin' } as never,
      'lesson-1',
      { status: 'completed' },
      { applyScope: 'series' },
    );

    expect(lessonRepoUpdates).toHaveLength(2);
    expect(lessonsService.cancelWithScope).not.toHaveBeenCalled();
  });

  it('aborts series fan-out before mutations when ACL denies a sibling', async () => {
    const lessonsService = {
      cancelWithScope: jest.fn(),
      update: jest.fn(),
      findById: jest.fn(),
      assertOccurrenceRescheduleSlot: jest.fn(),
    };
    const lessonAccess = {
      assertCanWriteLesson: jest
        .fn()
        .mockResolvedValueOnce({})
        .mockRejectedValueOnce(new ForbiddenException('Forbidden')),
    };
    const { svc } = buildSvc({ lessonsService, lessonAccess });

    await expect(
      svc.applyLessonUpdateWithRecurrence(
        { sub: 'u1', role: 'teacher' } as never,
        'lesson-1',
        { notes: 'x' },
        { applyScope: 'all' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(lessonsService.update).not.toHaveBeenCalled();
  });

  it('applyScope=this updates only the anchor lesson', async () => {
    const lessonsService = {
      cancelWithScope: jest.fn(),
      update: jest.fn(async () => ({ id: 'lesson-1', status: 'planned' })),
      findById: jest.fn(),
      assertOccurrenceRescheduleSlot: jest.fn(),
    };
    const { svc } = buildSvc({ lessonsService });

    await svc.applyLessonUpdateWithRecurrence(
      { sub: 'u1', role: 'admin' } as never,
      'lesson-1',
      { notes: 'only-one' },
      { applyScope: 'this' },
    );

    expect(lessonsService.update).toHaveBeenCalledTimes(1);
    expect(lessonsService.update).toHaveBeenCalledWith(
      expect.anything(),
      'lesson-1',
      expect.objectContaining({ notes: 'only-one' }),
    );
  });

  it('allows status=planned in a series field patch without refusing mass status', async () => {
    const lessonsService = {
      cancelWithScope: jest.fn(),
      update: jest.fn(async (_a: unknown, id: string) => ({ id, status: 'planned' })),
      findById: jest.fn(async () => ({ id: 'lesson-1' })),
      create: jest.fn(),
      assertOccurrenceRescheduleSlot: jest.fn(),
    };
    const lessonAccess = {
      assertCanWriteLesson: jest.fn(async () => ({})),
    };
    const { svc, lessonRepoUpdates } = buildSvc({ lessonsService, lessonAccess });

    await expect(
      svc.applyLessonUpdateWithRecurrence(
        { sub: 'u1', role: 'teacher' } as never,
        'lesson-1',
        { status: 'planned', notes: 'ok' },
        { applyScope: 'all' },
      ),
    ).resolves.toBeTruthy();

    expect(lessonRepoUpdates.length).toBeGreaterThan(0);
  });
});
