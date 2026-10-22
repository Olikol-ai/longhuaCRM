import { BadRequestException } from '@nestjs/common';
import { AvailabilityBookingEntity } from './entities/availability-booking.entity';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleService } from './schedule.service';
import { LessonEntity } from '../lessons/entities/lesson.entity';

const teacherA = '11111111-1111-4111-8111-111111111111';
const teacherB = '22222222-2222-4222-8222-222222222222';
const lessonMovedId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const lessonThuId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

/**
 * Stale teacher_availability_bookings must not block a slot after the lesson
 * moved to another date/teacher. Real same-day occupying lessons still block.
 */
describe('stale availability booking conflicts', () => {

  function buildService(opts: {
    occupyingLessons?: LessonEntity[];
    activeBookings?: AvailabilityBookingEntity[];
  }) {
    const occupyingLessons = opts.occupyingLessons ?? [];
    const activeBookings = opts.activeBookings ?? [];

    const repository = {
      findOccupyingLessonsByTeacherAndDate: jest.fn(
        async (teacherId: string, date: string) =>
          occupyingLessons.filter(
            (row) => row.teacherId === teacherId && row.date === date,
          ),
      ),
      findLessonsByTeacherAndDate: jest.fn(async (teacherId: string, date: string) =>
        occupyingLessons.filter(
          (row) => row.teacherId === teacherId && row.date === date,
        ),
      ),
      findActiveBookingsByTeacherAndDate: jest.fn(
        async (teacherId: string, date: string) => {
          // Mirror the fixed repository contract: only same teacher+date+occupying.
          return activeBookings.filter((booking) => {
            if (booking.teacherId !== teacherId || booking.date !== date) {
              return false;
            }
            if (booking.status !== 'active') return false;
            const lesson = occupyingLessons.find((row) => row.id === booking.lessonId);
            return Boolean(
              lesson &&
                lesson.teacherId === booking.teacherId &&
                lesson.date === booking.date &&
                (lesson.status === 'planned' || lesson.status === 'completed'),
            );
          });
        },
      ),
      findSlotsByTeacherId: jest.fn(async () => []),
      teacherExists: jest.fn(async () => true),
      syncBookingForLesson: jest.fn(async () => undefined),
      saveBooking: jest.fn(),
    } as unknown as ScheduleRepository;

    const access = {
      assertCanAccessTeacherSchedule: jest.fn(async () => undefined),
      scopeSlotFilter: jest.fn(async (_a: unknown, w: unknown) => w),
      scopeBookingFilter: jest.fn(async (_a: unknown, w: unknown) => w),
    };

    const service = new ScheduleService(repository, access as never);
    return { service, repository };
  }

  it('does not block Thursday when booking stayed on Thu but lesson moved to Sat 14:00', async () => {
    const satLesson = {
      id: lessonMovedId,
      teacherId: teacherA,
      date: '2026-10-24',
      startTime: '14:00:00',
      duration: 60,
      status: 'planned',
      lessonType: 'individual',
    } as LessonEntity;

    // Stale booking still points at Thursday 10:30 — must be ignored by the fixed filter.
    const staleBooking = {
      id: 'booking-stale',
      teacherId: teacherA,
      lessonId: lessonMovedId,
      date: '2026-10-22',
      timeFrom: '10:30:00',
      timeTo: '11:30:00',
      status: 'active',
    } as AvailabilityBookingEntity;

    const { service, repository } = buildService({
      occupyingLessons: [satLesson],
      activeBookings: [staleBooking],
    });

    const check = await service.checkAvailability(
      { sub: 'admin', role: 'admin' } as never,
      teacherA,
      '2026-10-22',
      '10:30',
      60,
    );
    expect(check.status).toBe('free');
    expect(check.occupied).toBe(false);
    expect(check.conflict).toBeNull();
    expect(String(check.conflict?.summary ?? '')).not.toMatch(/бронирование/i);

    await expect(
      service.assertNoScheduleConflicts(teacherA, '2026-10-22', '10:30', 60),
    ).resolves.toBeUndefined();

    // Repository helper is asked for Thu bookings; our mock applies the date/teacher filter.
    expect(repository.findActiveBookingsByTeacherAndDate).toHaveBeenCalledWith(
      teacherA,
      '2026-10-22',
    );
  });

  it('still blocks when a real planned lesson occupies Thursday 10:30', async () => {
    const thuLesson = {
      id: lessonThuId,
      teacherId: teacherA,
      date: '2026-10-22',
      startTime: '10:30:00',
      duration: 60,
      status: 'planned',
      lessonType: 'individual',
      primaryStudent: { name: 'Student X' },
    } as LessonEntity;

    const booking = {
      id: 'booking-live',
      teacherId: teacherA,
      lessonId: lessonThuId,
      date: '2026-10-22',
      timeFrom: '10:30:00',
      timeTo: '11:30:00',
      status: 'active',
    } as AvailabilityBookingEntity;

    const { service } = buildService({
      occupyingLessons: [thuLesson],
      activeBookings: [booking],
    });

    const check = await service.checkAvailability(
      { sub: 'admin', role: 'admin' } as never,
      teacherA,
      '2026-10-22',
      '10:30',
      60,
    );
    expect(check.status).toBe('busy');
    expect(check.occupied).toBe(true);
    expect(check.conflict?.lessonId).toBe(lessonThuId);
    expect(check.conflict?.summary).toMatch(/Занят:/);
    expect(check.conflict?.summary).not.toMatch(/бронирование/i);

    await expect(
      service.assertNoScheduleConflicts(teacherA, '2026-10-22', '10:30', 60),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('does not let teacher B booking block teacher A', async () => {
    const lessonB = {
      id: lessonThuId,
      teacherId: teacherB,
      date: '2026-10-22',
      startTime: '10:30:00',
      duration: 60,
      status: 'planned',
      lessonType: 'individual',
    } as LessonEntity;

    const bookingB = {
      id: 'booking-b',
      teacherId: teacherB,
      lessonId: lessonThuId,
      date: '2026-10-22',
      timeFrom: '10:30:00',
      timeTo: '11:30:00',
      status: 'active',
    } as AvailabilityBookingEntity;

    const { service } = buildService({
      occupyingLessons: [lessonB],
      activeBookings: [bookingB],
    });

    const check = await service.checkAvailability(
      { sub: 'admin', role: 'admin' } as never,
      teacherA,
      '2026-10-22',
      '10:30',
      60,
    );
    expect(check.status).toBe('free');
    expect(check.occupied).toBe(false);

    await expect(
      service.assertNoScheduleConflicts(teacherA, '2026-10-22', '10:30', 60),
    ).resolves.toBeUndefined();
  });

  it('syncLessonAvailabilityBooking normalizes times and forwards occupying=true', async () => {
    const repository = {
      syncBookingForLesson: jest.fn(async () => undefined),
      findSlotsByTeacherId: jest.fn(async () => []),
      teacherExists: jest.fn(async () => true),
    } as unknown as ScheduleRepository;

    const service = new ScheduleService(repository, {
      assertCanAccessTeacherSchedule: jest.fn(),
    } as never);

    await service.syncLessonAvailabilityBooking({
      lessonId: lessonMovedId,
      teacherId: teacherA,
      date: '2026-10-24',
      startTime: '14:00',
      duration: 60,
      occupying: true,
    });

    expect(repository.syncBookingForLesson).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: lessonMovedId,
        teacherId: teacherA,
        date: '2026-10-24',
        timeFrom: '14:00:00',
        timeTo: '15:00:00',
        occupying: true,
      }),
      undefined,
    );
  });

  it('syncLessonAvailabilityBooking cancels the lock when occupying=false', async () => {
    const repository = {
      syncBookingForLesson: jest.fn(async () => undefined),
      findSlotsByTeacherId: jest.fn(async () => []),
      teacherExists: jest.fn(async () => true),
    } as unknown as ScheduleRepository;

    const service = new ScheduleService(repository, {
      assertCanAccessTeacherSchedule: jest.fn(),
    } as never);

    await service.syncLessonAvailabilityBooking({
      lessonId: lessonMovedId,
      teacherId: teacherA,
      date: '2026-10-22',
      startTime: '10:30',
      duration: 60,
      occupying: false,
    });

    expect(repository.syncBookingForLesson).toHaveBeenCalledWith(
      expect.objectContaining({
        lessonId: lessonMovedId,
        occupying: false,
      }),
      undefined,
    );
  });
});

describe('lesson create concurrency contract (teacher lock + re-check)', () => {
  it('create() re-checks conflicts after locking the teacher row', () => {
    // Source contract: overlapping creates serialize on TeacherEntity pessimistic_write
    // then call assertNoScheduleConflicts again inside the transaction.
    const { readFileSync } = require('fs') as typeof import('fs');
    const { join } = require('path') as typeof import('path');
    const src = readFileSync(
      join(__dirname, '../lessons/lessons.service.ts'),
      'utf8',
    );
    expect(src).toMatch(/lock:\s*\{\s*mode:\s*'pessimistic_write'/);
    expect(src).toMatch(/assertNoScheduleConflicts/);
    expect(src).toMatch(/syncLessonAvailabilityBooking/);
    expect(src).toMatch(/recordExceptionThen/);
  });
});

describe('ScheduleRepository.findActiveBookingsByTeacherAndDate SQL contract', () => {
  it('joins lesson on teacher_id and date, not only lesson_id', () => {
    const joins: string[] = [];
    const wheres: string[] = [];
    const qb = {
      innerJoin: (_entity: unknown, _alias: string, condition: string) => {
        joins.push(condition);
        return qb;
      },
      where: (sql: string) => {
        wheres.push(sql);
        return qb;
      },
      andWhere: (sql: string) => {
        wheres.push(sql);
        return qb;
      },
      getMany: async () => [],
    };

    const bookingRepo = {
      createQueryBuilder: () => qb,
    };

    const repo = new ScheduleRepository(
      {} as never,
      bookingRepo as never,
      {} as never,
      {} as never,
    );

    return repo.findActiveBookingsByTeacherAndDate(teacherA, '2026-10-22').then(() => {
      expect(joins.some((j) => /lesson\.teacher_id\s*=\s*booking\.teacher_id/i.test(j))).toBe(
        true,
      );
      expect(joins.some((j) => /lesson\.date\s*=\s*booking\.date/i.test(j))).toBe(true);
      expect(wheres.join(' ')).toMatch(/booking\.teacher_id/);
      expect(wheres.join(' ')).toMatch(/booking\.date/);
    });
  });
});

describe('ScheduleRepository.syncBookingForLesson', () => {
  it('updates existing booking instead of inserting a duplicate', async () => {
    const update = jest.fn(async () => ({ affected: 1 }));
    const save = jest.fn();
    const create = jest.fn((row: unknown) => row);
    const bookingRepo = { update, save, create } as never;

    const repo = new ScheduleRepository({} as never, bookingRepo, {} as never, {} as never);
    await repo.syncBookingForLesson(
      {
        lessonId: 'lesson-1',
        teacherId: teacherA,
        date: '2026-10-24',
        timeFrom: '14:00:00',
        timeTo: '15:00:00',
        occupying: true,
      },
      bookingRepo,
    );

    expect(update).toHaveBeenCalledWith(
      { lessonId: 'lesson-1' },
      expect.objectContaining({
        teacherId: teacherA,
        date: '2026-10-24',
        status: 'active',
      }),
    );
    expect(save).not.toHaveBeenCalled();
  });

  it('inserts when no booking row exists yet', async () => {
    const update = jest.fn(async () => ({ affected: 0 }));
    const save = jest.fn(async (row: unknown) => row);
    const create = jest.fn((row: unknown) => row);
    const bookingRepo = { update, save, create } as never;

    const repo = new ScheduleRepository({} as never, bookingRepo, {} as never, {} as never);
    await repo.syncBookingForLesson(
      {
        lessonId: 'lesson-1',
        teacherId: teacherA,
        date: '2026-10-24',
        timeFrom: '14:00:00',
        timeTo: '15:00:00',
        occupying: true,
      },
      bookingRepo,
    );

    expect(save).toHaveBeenCalled();
  });

  it('cancels bookings when the slot is released', async () => {
    const update = jest.fn(async () => ({ affected: 1 }));
    const bookingRepo = { update, save: jest.fn(), create: jest.fn() } as never;
    const repo = new ScheduleRepository({} as never, bookingRepo, {} as never, {} as never);

    await repo.syncBookingForLesson(
      {
        lessonId: 'lesson-1',
        teacherId: teacherA,
        date: '2026-10-22',
        timeFrom: '10:30:00',
        timeTo: '11:30:00',
        occupying: false,
      },
      bookingRepo,
    );

    expect(update).toHaveBeenCalledWith({ lessonId: 'lesson-1' }, { status: 'cancelled' });
  });
});
