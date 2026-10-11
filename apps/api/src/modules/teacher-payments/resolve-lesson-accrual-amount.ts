import {
  isTrialLessonType,
  TRIAL_LESSON_TEACHER_PAYMENT_BYN,
} from '../lessons/lesson-trial';

/**
 * Resolve teacher pay for one completed lesson.
 *
 * Architecture (unchanged):
 * - Preferred SSOT = teacher_payments.amount captured at completion (positive snapshot).
 * - Trial lessons always use the fixed trial payout, never hourlyRate.
 * - Legacy / broken zero snapshots (rate was unset at completion) are treated like a
 *   missing accrual and fall back to current teachers.hourly_rate × duration hours.
 */
export function resolveLessonTeacherAmount(params: {
  accruedAmount: number | null | undefined;
  lessonType: string | null | undefined;
  hourlyRate: number | null | undefined;
  durationMinutes: number | null | undefined;
}): number {
  const duration = Number(params.durationMinutes ?? 60);
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 60;

  if (isTrialLessonType(params.lessonType)) {
    return TRIAL_LESSON_TEACHER_PAYMENT_BYN;
  }

  const accruedRaw = params.accruedAmount;
  if (accruedRaw != null && Number.isFinite(Number(accruedRaw))) {
    const accrued = Math.round(Number(accruedRaw) * 100) / 100;
    // Positive historical snapshot wins (rate changes later must not rewrite history).
    if (accrued > 0) {
      return accrued;
    }
    // accrued === 0 is a legacy gap from completing lessons while hourly_rate was 0/null.
  }

  const hourlyRate = Number(params.hourlyRate ?? 0);
  const safeRate = Number.isFinite(hourlyRate) && hourlyRate > 0 ? hourlyRate : 0;
  const hours = safeDuration / 60;
  return Math.round(safeRate * hours * 100) / 100;
}

/**
 * Whether createForCompletedLesson should persist a row.
 * Zero non-trial accruals must not be stored — they poison later summary reads
 * (0 is treated as a real snapshot and blocks fallback to current hourly_rate).
 */
export function shouldPersistLessonTeacherAccrual(params: {
  lessonType: string | null | undefined;
  hourlyRate: number | null | undefined;
}): boolean {
  if (isTrialLessonType(params.lessonType)) {
    return true;
  }
  const hourlyRate = Number(params.hourlyRate ?? 0);
  return Number.isFinite(hourlyRate) && hourlyRate > 0;
}
