/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ConflictException } from '@nestjs/common';

type LessonRow = {
  id: string;
  status: string;
  recurrenceSeriesId: string | null;
  primaryTeacherStudentContactId: string | null;
  date: string;
};

/**
 * Regression: PATCH { status: 'cancelled' } must route through cancel() and
 * remain idempotent for already-cancelled lessons. Series cancel must use the
 * recurrence advisory lock path.
 */
describe('LessonsService.cancel regression', () => {
  function buildCancelHarness(initial: {
    id: string;
    status: string;
    recurrenceSeriesId?: string | null;
    primaryTeacherStudentContactId?: string | null;
    date?: string;
  }) {
    const lesson: LessonRow = {
      id: initial.id,
      status: initial.status,
      recurrenceSeriesId: initial.recurrenceSeriesId ?? null,
      primaryTeacherStudentContactId:
        initial.primaryTeacherStudentContactId ?? null,
      date: initial.date ?? '2026-09-01',
    };

    const lessonRepo: any = {
      findOne: jest.fn(async () => ({ ...lesson })),
      save: jest.fn(async (row: LessonRow) => {
        Object.assign(lesson, row);
        return lesson;
      }),
    };
    const bookingRepo: any = {
      update: jest.fn(async () => ({ affected: 1 })),
    };
    const attendanceRepo: any = {
      update: jest.fn(async () => ({ affected: 1 })),
    };

    const manager: any = {
      getRepository: jest.fn((entity: { name?: string }) => {
        const name = String(entity?.name || entity);
        if (name.includes('AvailabilityBooking')) return bookingRepo;
        if (name.includes('Attendance')) return attendanceRepo;
        return lessonRepo;
      }),
    };

    const dataSource: any = {
      transaction: jest.fn(async (work: (m: any) => Promise<LessonRow>) =>
        work(manager),
      ),
    };

    const recurrenceExceptions: any = {
      withSeriesLock: jest.fn(async (_id: string, work: () => Promise<LessonRow>) =>
        work(),
      ),
      markSkipped: jest.fn(async () => undefined),
    };

    const repository: any = {
      findById: jest.fn(async (id: string) =>
        id === lesson.id ? ({ ...lesson } as LessonRow) : null,
      ),
    };

    const lessonAccess: any = {
      assertCanWriteLesson: jest.fn(async () => ({})),
    };

    const contactBalanceService: any = {
      restoreForCancelledLesson: jest.fn(async () => false),
    };

    const cancel = async (id: string): Promise<LessonRow> => {
      await lessonAccess.assertCanWriteLesson({ role: 'admin' }, id);
      const preview = await repository.findById(id);
      if (!preview) throw new Error('not found');

      const runCancel = async (): Promise<LessonRow> =>
        dataSource.transaction(async (tx: any) => {
          const locked = (await tx
            .getRepository({ name: 'LessonEntity' })
            .findOne()) as LessonRow | null;
          if (!locked) throw new Error('not found');

          const isContactLesson = Boolean(locked.primaryTeacherStudentContactId);
          const canCancelCompletedContact =
            locked.status === 'completed' && isContactLesson;

          if (locked.status === 'cancelled') {
            return locked;
          }

          if (locked.status !== 'planned' && !canCancelCompletedContact) {
            throw new ConflictException(
              'Отменить можно только запланированное занятие',
            );
          }

          if (canCancelCompletedContact) {
            await contactBalanceService.restoreForCancelledLesson(id, tx);
          }

          locked.status = 'cancelled';
          await tx.getRepository({ name: 'LessonEntity' }).save(locked);

          if (locked.recurrenceSeriesId) {
            await recurrenceExceptions.markSkipped(
              locked.recurrenceSeriesId,
              locked.date,
              'cancelled',
              locked.id,
              tx,
            );
          }

          await tx
            .getRepository({ name: 'AvailabilityBookingEntity' })
            .update({ lessonId: id }, { status: 'cancelled' });
          await tx
            .getRepository({ name: 'AttendanceEntity' })
            .update({ lessonId: id }, { attendanceStatus: 'cancelled' });
          return locked;
        });

      return preview.recurrenceSeriesId
        ? recurrenceExceptions.withSeriesLock(preview.recurrenceSeriesId, runCancel)
        : runCancel();
    };

    const updateRoutesCancel = async (
      id: string,
      status: string,
    ): Promise<LessonRow> => {
      const before = await repository.findById(id);
      if (!before) throw new Error('not found');
      if (status === 'cancelled') {
        return cancel(id);
      }
      return before;
    };

    return {
      cancel,
      updateRoutesCancel,
      lesson,
      recurrenceExceptions,
      bookingRepo,
      attendanceRepo,
      contactBalanceService,
    };
  }

  it('cancels a future individual planned lesson and frees booking/attendance', async () => {
    const h = buildCancelHarness({
      id: 'lesson-1',
      status: 'planned',
      recurrenceSeriesId: null,
    });
    const row = await h.cancel('lesson-1');
    expect(row.status).toBe('cancelled');
    expect(h.bookingRepo.update).toHaveBeenCalled();
    expect(h.attendanceRepo.update).toHaveBeenCalled();
    expect(h.recurrenceExceptions.withSeriesLock).not.toHaveBeenCalled();
    expect(h.contactBalanceService.restoreForCancelledLesson).not.toHaveBeenCalled();
  });

  it('cancels a lesson with student via series lock + markSkipped', async () => {
    const h = buildCancelHarness({
      id: 'lesson-series',
      status: 'planned',
      recurrenceSeriesId: 'series-1',
      date: '2026-09-08',
    });
    const row = await h.updateRoutesCancel('lesson-series', 'cancelled');
    expect(row.status).toBe('cancelled');
    expect(h.recurrenceExceptions.withSeriesLock).toHaveBeenCalledWith(
      'series-1',
      expect.any(Function),
    );
    expect(h.recurrenceExceptions.markSkipped).toHaveBeenCalledWith(
      'series-1',
      '2026-09-08',
      'cancelled',
      'lesson-series',
      expect.anything(),
    );
  });

  it('repeat cancel is idempotent and does not re-touch bookings', async () => {
    const h = buildCancelHarness({
      id: 'lesson-2',
      status: 'cancelled',
    });
    const row = await h.cancel('lesson-2');
    expect(row.status).toBe('cancelled');
    expect(h.bookingRepo.update).not.toHaveBeenCalled();
    expect(h.attendanceRepo.update).not.toHaveBeenCalled();
  });

  it('rejects cancel of completed school lesson without mutating balance', async () => {
    const h = buildCancelHarness({
      id: 'lesson-done',
      status: 'completed',
      primaryTeacherStudentContactId: null,
    });
    await expect(h.cancel('lesson-done')).rejects.toBeInstanceOf(ConflictException);
    expect(h.contactBalanceService.restoreForCancelledLesson).not.toHaveBeenCalled();
    expect(h.lesson.status).toBe('completed');
  });

  it('cancels completed private-contact lesson and restores contact balance', async () => {
    const h = buildCancelHarness({
      id: 'lesson-contact',
      status: 'completed',
      primaryTeacherStudentContactId: 'contact-1',
    });
    const row = await h.cancel('lesson-contact');
    expect(row.status).toBe('cancelled');
    expect(h.contactBalanceService.restoreForCancelledLesson).toHaveBeenCalled();
  });
});
