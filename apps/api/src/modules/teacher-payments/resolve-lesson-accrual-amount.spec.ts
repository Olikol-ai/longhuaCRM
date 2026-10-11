import {
  resolveLessonTeacherAmount,
  shouldPersistLessonTeacherAccrual,
} from './resolve-lesson-accrual-amount';
import { TRIAL_LESSON_TEACHER_PAYMENT_BYN } from '../lessons/lesson-trial';

describe('resolveLessonTeacherAmount', () => {
  it('uses duration × hourlyRate when accrual is missing', () => {
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: null,
        lessonType: 'individual',
        hourlyRate: 20,
        durationMinutes: 60,
      }),
    ).toBe(20);
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: undefined,
        lessonType: 'individual',
        hourlyRate: 20,
        durationMinutes: 30,
      }),
    ).toBe(10);
  });

  it('falls back to current hourlyRate when stored accrual is 0 (legacy unset rate)', () => {
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: 0,
        lessonType: 'individual',
        hourlyRate: 20,
        durationMinutes: 60,
      }),
    ).toBe(20);
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: 0,
        lessonType: 'individual',
        hourlyRate: 20,
        durationMinutes: 30,
      }),
    ).toBe(10);
  });

  it('keeps positive historical snapshot even if current rate changed', () => {
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: 15,
        lessonType: 'individual',
        hourlyRate: 20,
        durationMinutes: 60,
      }),
    ).toBe(15);
  });

  it('uses fixed trial payout and ignores hourlyRate / zero accrual', () => {
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: 0,
        lessonType: 'trial',
        hourlyRate: 20,
        durationMinutes: 60,
      }),
    ).toBe(TRIAL_LESSON_TEACHER_PAYMENT_BYN);
  });

  it('returns 0 when there is no accrual and current rate is 0/null', () => {
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: null,
        lessonType: 'individual',
        hourlyRate: 0,
        durationMinutes: 60,
      }),
    ).toBe(0);
    expect(
      resolveLessonTeacherAmount({
        accruedAmount: 0,
        lessonType: 'individual',
        hourlyRate: null,
        durationMinutes: 60,
      }),
    ).toBe(0);
  });

  it('matches the September bug case: mix of zero accruals + current rate 20', () => {
    const lessons = [
      { duration: 60, accrued: 20 },
      { duration: 30, accrued: 10 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 0 },
      { duration: 60, accrued: 20 },
    ];
    const amounts = lessons.map((lesson) =>
      resolveLessonTeacherAmount({
        accruedAmount: lesson.accrued,
        lessonType: 'individual',
        hourlyRate: 20,
        durationMinutes: lesson.duration,
      }),
    );
    expect(amounts).toEqual([
      20, 10, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20,
    ]);
  });
});

describe('shouldPersistLessonTeacherAccrual', () => {
  it('persists trial accruals', () => {
    expect(
      shouldPersistLessonTeacherAccrual({ lessonType: 'trial', hourlyRate: 0 }),
    ).toBe(true);
  });

  it('does not persist zero non-trial accruals', () => {
    expect(
      shouldPersistLessonTeacherAccrual({
        lessonType: 'individual',
        hourlyRate: 0,
      }),
    ).toBe(false);
    expect(
      shouldPersistLessonTeacherAccrual({
        lessonType: 'individual',
        hourlyRate: null,
      }),
    ).toBe(false);
  });

  it('persists when hourlyRate is positive', () => {
    expect(
      shouldPersistLessonTeacherAccrual({
        lessonType: 'individual',
        hourlyRate: 20,
      }),
    ).toBe(true);
  });
});
