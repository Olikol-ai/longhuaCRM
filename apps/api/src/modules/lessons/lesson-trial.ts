/**
 * School trial lesson (пробное занятие).
 * Fixed teacher payroll — never derived from hourlyRate or student pricing.
 */
export const TRIAL_LESSON_TYPE = 'trial' as const;

/** Fixed teacher accrual for one completed trial lesson (BYN). */
export const TRIAL_LESSON_TEACHER_PAYMENT_BYN = 10;

export function isTrialLessonType(
  lessonType: string | null | undefined,
): boolean {
  return lessonType === TRIAL_LESSON_TYPE;
}
