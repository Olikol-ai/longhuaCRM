import { ForbiddenException } from '@nestjs/common';
import { LessonRecurrenceService } from './lesson-recurrence.service';
import { LessonEntity } from './entities/lesson.entity';
import { LessonRecurrenceSeriesEntity } from './entities/lesson-recurrence-series.entity';

type PlannedRow = Pick<LessonEntity, 'id' | 'date' | 'status' | 'recurrenceSeriesId'> & {
  startTime?: string;
  duration?: number;
  teacherId?: string;
};

function buildRescheduleSvc(initial: {
  anchorId?: string;
  anchorDate?: string;
  siblings?: PlannedRow[];
  series?: Partial<LessonRecurrenceSeriesEntity>;
}) {
  const anchorId = initial.anchorId ?? 'lesson-1';
  const anchorDate = initial.anchorDate ?? '2026-09-01';
  const series: LessonRecurrenceSeriesEntity = {
    id: 'series-1',
    status: 'active',
    weekday: 1, // Tuesday
    startDate: '2026-09-01',
    startTime: '10:00',
    duration: 60,
    teacherId: 'teacher-1',
    tutorId: null,
    groupId: null,
    primaryStudentId: 'student-1',
    primaryTutorStudentId: null,
    primaryTeacherStudentContactId: null,
    lessonType: 'individual',
    lessonFormat: 'online',
    meetingLink: null,
    room: null,
    notes: null,
    untilDate: '2026-09-30',
    createdByUserId: 'admin-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...initial.series,
  };

  let planned: PlannedRow[] =
    initial.siblings ??
    [
      {
        id: 'lesson-1',
        date: '2026-09-01',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
        startTime: '10:00',
        duration: 60,
        teacherId: 'teacher-1',
      },
      {
        id: 'lesson-2',
        date: '2026-09-08',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
        startTime: '10:00',
        duration: 60,
        teacherId: 'teacher-1',
      },
      {
        id: 'lesson-3',
        date: '2026-09-15',
        status: 'planned',
        recurrenceSeriesId: 'series-1',
        startTime: '10:00',
        duration: 60,
        teacherId: 'teacher-1',
      },
    ];

  const skipped = new Set<string>();
  const markSkippedCalls: Array<{ date: string; reason: string; lessonId: string }> = [];

  const lessonRepo = {
    findOne: jest.fn(async ({ where }: { where: { id: string } }) => {
      const row = planned.find((item) => item.id === where.id);
      if (!row) return null;
      return {
        id: row.id,
        status: row.status,
        recurrenceSeriesId: row.recurrenceSeriesId,
        date: row.date,
        startTime: row.startTime ?? '10:00',
        duration: row.duration ?? 60,
        teacherId: row.teacherId ?? 'teacher-1',
        tutorId: null,
        groupId: null,
        primaryStudentId: 'student-1',
        lessonType: 'individual',
      };
    }),
    find: jest.fn(async (opts?: { where?: Record<string, unknown> }) => {
      if (opts?.where?.recurrenceSeriesId === 'series-1') {
        if (opts.where.status === 'planned') {
          return planned
            .filter((row) => row.status === 'planned')
            .map((row) => ({ ...row }));
        }
        return planned.map((row) => ({
          id: row.id,
          date: row.date,
          status: row.status,
        }));
      }
      return [];
    }),
    update: jest.fn(
      async (idOrCriteria: string | { id: string }, patch: Partial<PlannedRow>) => {
        const id = typeof idOrCriteria === 'string' ? idOrCriteria : idOrCriteria.id;
        planned = planned.map((row) => (row.id === id ? { ...row, ...patch } : row));
      },
    ),
    findOneOrFail: jest.fn(),
    save: jest.fn(),
  };

  const seriesRepo = {
    findOne: jest.fn(async () => ({ ...series })),
    save: jest.fn(async (row: LessonRecurrenceSeriesEntity) => {
      Object.assign(series, row);
      return row;
    }),
    create: jest.fn(),
    find: jest.fn(),
    delete: jest.fn(),
  };

  let lock: Promise<void> = Promise.resolve();
  const withSeriesLock = async (_id: string, work: () => Promise<unknown>) => {
    const prev = lock;
    let release!: () => void;
    lock = new Promise<void>((resolve) => {
      release = resolve;
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
    markSkipped: jest.fn(
      async (
        _seriesId: string,
        date: string,
        reason: string,
        lessonId: string | null,
      ) => {
        skipped.add(String(date).slice(0, 10));
        markSkippedCalls.push({ date: String(date).slice(0, 10), reason, lessonId: lessonId ?? '' });
      },
    ),
    recordExceptionThen: jest.fn(),
  };

  const lessonsService = {
    cancelWithScope: jest.fn(),
    update: jest.fn(async (_actor: unknown, id: string, patch: Record<string, unknown>) => {
      if (patch.date !== undefined) {
        throw new Error('fan-out must not pass date');
      }
      planned = planned.map((row) =>
        row.id === id
          ? {
              ...row,
              ...(patch.startTime ? { startTime: String(patch.startTime) } : {}),
              ...(patch.notes !== undefined ? { notes: String(patch.notes) } : {}),
            }
          : row,
      );
      const row = planned.find((item) => item.id === id);
      return { id, status: row?.status ?? 'planned', date: row?.date };
    }),
    findById: jest.fn(async () => {
      const row = planned.find((item) => item.id === anchorId);
      return { id: anchorId, date: row?.date ?? anchorDate, status: 'planned' };
    }),
    assertOccurrenceRescheduleSlot: jest.fn(async () => undefined),
    create: jest.fn(),
    delete: jest.fn(),
  };

  const lessonAccess = {
    assertCanWriteLesson: jest.fn(async () => ({})),
  };

  const dataSource = {
    transaction: jest.fn(async (work: (manager: unknown) => Promise<unknown>) => {
      const manager = {
        getRepository: (entity: unknown) => {
          if (entity === LessonRecurrenceSeriesEntity) {
            return seriesRepo;
          }
          return {
            save: seriesRepo.save,
            update: lessonRepo.update,
          };
        },
      };
      return work(manager);
    }),
  };

  const svc = new LessonRecurrenceService(
    seriesRepo as never,
    lessonRepo as never,
    lessonsService as never,
    exceptions as never,
    lessonAccess as never,
    dataSource as never,
  );

  jest.spyOn(svc as never, 'fillHorizonCore' as never).mockResolvedValue(0 as never);

  return {
    svc,
    series,
    getPlanned: () => planned.map((row) => ({ ...row })),
    markSkippedCalls,
    skipped,
    lessonsService,
    lessonAccess,
    anchorId,
    anchorDate,
  };
}

describe('LessonRecurrenceService series date reschedule', () => {
  it('computeSeriesDateMoves: Tue 01.09 → Wed 02.09 following shifts anchor + tail', () => {
    const svc = Object.create(LessonRecurrenceService.prototype) as LessonRecurrenceService;
    const moves = svc.computeSeriesDateMoves(
      [
        { id: 'lesson-1', date: '2026-09-01' },
        { id: 'lesson-2', date: '2026-09-08' },
        { id: 'lesson-3', date: '2026-09-15' },
      ],
      'following',
      '2026-09-01',
      '2026-09-02',
      'lesson-1',
    );
    expect(moves).toEqual([
      { lessonId: 'lesson-1', oldDate: '2026-09-01', newDate: '2026-09-02' },
      { lessonId: 'lesson-2', oldDate: '2026-09-08', newDate: '2026-09-09' },
      { lessonId: 'lesson-3', oldDate: '2026-09-15', newDate: '2026-09-16' },
    ]);
  });

  it('computeSeriesDateMoves: following from middle occurrence leaves earlier rows', () => {
    const svc = Object.create(LessonRecurrenceService.prototype) as LessonRecurrenceService;
    const moves = svc.computeSeriesDateMoves(
      [
        { id: 'lesson-1', date: '2026-09-01' },
        { id: 'lesson-2', date: '2026-09-08' },
        { id: 'lesson-3', date: '2026-09-15' },
      ],
      'following',
      '2026-09-08',
      '2026-09-09',
      'lesson-2',
    );
    expect(moves).toEqual([
      { lessonId: 'lesson-2', oldDate: '2026-09-08', newDate: '2026-09-09' },
      { lessonId: 'lesson-3', oldDate: '2026-09-15', newDate: '2026-09-16' },
    ]);
  });

  it('computeSeriesDateMoves: all shifts every planned occurrence', () => {
    const svc = Object.create(LessonRecurrenceService.prototype) as LessonRecurrenceService;
    const moves = svc.computeSeriesDateMoves(
      [
        { id: 'lesson-1', date: '2026-09-01' },
        { id: 'lesson-2', date: '2026-09-08' },
        { id: 'lesson-3', date: '2026-09-15' },
      ],
      'all',
      '2026-09-08',
      '2026-09-09',
      'lesson-2',
    );
    expect(moves).toEqual([
      { lessonId: 'lesson-1', oldDate: '2026-09-01', newDate: '2026-09-02' },
      { lessonId: 'lesson-2', oldDate: '2026-09-08', newDate: '2026-09-09' },
      { lessonId: 'lesson-3', oldDate: '2026-09-15', newDate: '2026-09-16' },
    ]);
  });

  it('computeSeriesDateMoves: preserves spacing across month boundary', () => {
    const svc = Object.create(LessonRecurrenceService.prototype) as LessonRecurrenceService;
    const moves = svc.computeSeriesDateMoves(
      [
        { id: 'lesson-1', date: '2026-08-25' },
        { id: 'lesson-2', date: '2026-09-01' },
      ],
      'following',
      '2026-08-25',
      '2026-08-26',
      'lesson-1',
    );
    expect(moves).toEqual([
      { lessonId: 'lesson-1', oldDate: '2026-08-25', newDate: '2026-08-26' },
      { lessonId: 'lesson-2', oldDate: '2026-09-01', newDate: '2026-09-02' },
    ]);
  });

  it('applyScope=following from middle occurrence (Test 2) leaves earlier Tue, shifts tail to Wed', async () => {
    const ctx = buildRescheduleSvc({
      anchorId: 'lesson-2',
      anchorDate: '2026-09-08',
      siblings: [
        { id: 'lesson-1', date: '2026-09-01', status: 'planned', recurrenceSeriesId: 'series-1', startTime: '18:30' },
        { id: 'lesson-2', date: '2026-09-08', status: 'planned', recurrenceSeriesId: 'series-1', startTime: '18:30' },
        { id: 'lesson-3', date: '2026-09-15', status: 'planned', recurrenceSeriesId: 'series-1', startTime: '18:30' },
        { id: 'lesson-4', date: '2026-09-22', status: 'planned', recurrenceSeriesId: 'series-1', startTime: '18:30' },
      ],
      series: { startTime: '18:30' },
    });

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-2',
      { date: '2026-09-09' },
      { applyScope: 'following' },
    );

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-01',
      '2026-09-09',
      '2026-09-16',
      '2026-09-23',
    ]);
    expect(ctx.getPlanned().find((row) => row.id === 'lesson-1')?.date).toBe('2026-09-01');
    expect(ctx.skipped.has('2026-09-08')).toBe(true);
    expect(ctx.skipped.has('2026-09-01')).toBe(false);
  });

  it('applyScope=all (Test 3) shifts four Tuesdays to Wednesdays', async () => {
    const ctx = buildRescheduleSvc({
      siblings: [
        { id: 'lesson-1', date: '2026-09-01', status: 'planned', recurrenceSeriesId: 'series-1' },
        { id: 'lesson-2', date: '2026-09-08', status: 'planned', recurrenceSeriesId: 'series-1' },
        { id: 'lesson-3', date: '2026-09-15', status: 'planned', recurrenceSeriesId: 'series-1' },
        { id: 'lesson-4', date: '2026-09-22', status: 'planned', recurrenceSeriesId: 'series-1' },
      ],
    });

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'all' },
    );

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
      '2026-09-23',
    ]);
  });

  it('preserves startTime when only date changes (Test 4)', async () => {
    const ctx = buildRescheduleSvc({
      series: { startTime: '18:30' },
      siblings: [
        { id: 'lesson-1', date: '2026-09-01', status: 'planned', recurrenceSeriesId: 'series-1', startTime: '18:30' },
        { id: 'lesson-2', date: '2026-09-08', status: 'planned', recurrenceSeriesId: 'series-1', startTime: '18:30' },
      ],
    });

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'following' },
    );

    expect(ctx.getPlanned().every((row) => row.startTime === '18:30')).toBe(true);
    expect(ctx.series.startTime).toBe('18:30');
  });

  it('double save does not duplicate or re-move dates (Test 5)', async () => {
    const ctx = buildRescheduleSvc({});

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'following' },
    );
    const afterFirst = ctx.getPlanned().map((row) => row.date);

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'following' },
    );
    const afterSecond = ctx.getPlanned().map((row) => row.date);

    expect(afterFirst).toEqual(['2026-09-02', '2026-09-09', '2026-09-16']);
    expect(afterSecond).toEqual(afterFirst);
    expect(ctx.getPlanned()).toHaveLength(3);
  });

  it('respects existing exception dates during fillHorizon after move (Test 7)', async () => {
    const ctx = buildRescheduleSvc({});
    ctx.skipped.add('2026-09-01');

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'following' },
    );

    expect(ctx.skipped.has('2026-09-01')).toBe(true);
    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
    ]);
  });

  it('applyScope=following from 2026-10-27 → 2026-10-28 (E2E Test 2 dates)', async () => {
    const ctx = buildRescheduleSvc({
      anchorId: 'lesson-2',
      anchorDate: '2026-10-27',
      siblings: [
        { id: 'lesson-1', date: '2026-10-20', status: 'planned', recurrenceSeriesId: 'series-1' },
        { id: 'lesson-2', date: '2026-10-27', status: 'planned', recurrenceSeriesId: 'series-1' },
        { id: 'lesson-3', date: '2026-11-03', status: 'planned', recurrenceSeriesId: 'series-1' },
        { id: 'lesson-4', date: '2026-11-10', status: 'planned', recurrenceSeriesId: 'series-1' },
      ],
    });

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-2',
      { date: '2026-10-28' },
      { applyScope: 'following' },
    );

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-10-20',
      '2026-10-28',
      '2026-11-04',
      '2026-11-11',
    ]);
  });

  it('applyScope=following moves Tue 01.09 → Wed 02.09 and tail without duplicates', async () => {
    const ctx = buildRescheduleSvc({});

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'following' },
    );

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
    ]);
    expect(ctx.markSkippedCalls.map((row) => row.date)).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
    ]);
    expect(ctx.skipped.has('2026-09-01')).toBe(true);
    expect(ctx.series.weekday).toBe(2); // Wednesday
    expect(ctx.series.startDate).toBe('2026-09-01');
    expect(ctx.lessonsService.assertOccurrenceRescheduleSlot).toHaveBeenCalledTimes(3);
  });

  it('applyScope=this delegates single-occurrence date move to LessonsService.update', async () => {
    const ctx = buildRescheduleSvc({});
    ctx.lessonsService.update.mockImplementation(async () => ({
      id: 'lesson-1',
      date: '2026-09-02',
      status: 'planned',
    }));

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'teacher-1', role: 'teacher' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'this' },
    );

    expect(ctx.lessonsService.update).toHaveBeenCalledTimes(1);
    expect(ctx.lessonsService.update).toHaveBeenCalledWith(
      expect.anything(),
      'lesson-1',
      expect.objectContaining({ date: '2026-09-02' }),
    );
    expect(ctx.markSkippedCalls).toHaveLength(0);
  });

  it('applyScope=all shifts entire series to new weekday', async () => {
    const ctx = buildRescheduleSvc({});

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'all' },
    );

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
    ]);
    expect(ctx.series.startDate).toBe('2026-09-02');
    expect(ctx.series.weekday).toBe(2);
  });

  it('applyScope=all from middle occurrence still shifts first planned row', async () => {
    const ctx = buildRescheduleSvc({ anchorId: 'lesson-2', anchorDate: '2026-09-08' });

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-2',
      { date: '2026-09-09' },
      { applyScope: 'all' },
    );

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-02',
      '2026-09-09',
      '2026-09-16',
    ]);
    expect(ctx.series.startDate).toBe('2026-09-02');
  });

  it('preflights ACL and schedule before any mutation', async () => {
    const ctx = buildRescheduleSvc({});
    ctx.lessonAccess.assertCanWriteLesson
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new ForbiddenException('Forbidden'));

    await expect(
      ctx.svc.applyLessonUpdateWithRecurrence(
        { sub: 'teacher-1', role: 'teacher' } as never,
        'lesson-1',
        { date: '2026-09-02' },
        { applyScope: 'following' },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);

    expect(ctx.getPlanned().map((row) => row.date)).toEqual([
      '2026-09-01',
      '2026-09-08',
      '2026-09-15',
    ]);
    expect(ctx.markSkippedCalls).toHaveLength(0);
  });

  it('records rescheduled exceptions for every moved old date', async () => {
    const ctx = buildRescheduleSvc({});

    await ctx.svc.applyLessonUpdateWithRecurrence(
      { sub: 'admin-1', role: 'admin' } as never,
      'lesson-1',
      { date: '2026-09-02' },
      { applyScope: 'following' },
    );

    for (const date of ['2026-09-01', '2026-09-08', '2026-09-15']) {
      expect(ctx.skipped.has(date)).toBe(true);
    }
    expect(ctx.markSkippedCalls.every((row) => row.reason === 'rescheduled')).toBe(true);
  });
});
