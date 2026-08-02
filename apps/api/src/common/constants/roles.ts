export const APP_ROLES = ['admin', 'teacher', 'tutor', 'student', 'tutor_student'] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const RESTRICTED_ROLES = ['pending', 'user'] as const;

export type NormalizedRole = AppRole | 'pending';

/**
 * HSK Academy / Exam Content — school Longhua only.
 * Tutors and tutor_students use Assessment, not Academy.
 */
export const HSK_ACADEMY_ROLES = ['admin', 'teacher', 'student'] as const;
export type HskAcademyRole = (typeof HSK_ACADEMY_ROLES)[number];

/** Exam Content Studio + HSK question bank authoring */
export const HSK_ACADEMY_STAFF_ROLES = ['admin', 'teacher'] as const;
export type HskAcademyStaffRole = (typeof HSK_ACADEMY_STAFF_ROLES)[number];

export function normalizeRole(role: string | undefined | null): NormalizedRole {
  if (
    role === 'admin' ||
    role === 'teacher' ||
    role === 'tutor' ||
    role === 'student' ||
    role === 'tutor_student'
  ) {
    return role;
  }
  return 'pending';
}

export function isAppRole(role: string): role is AppRole {
  return (APP_ROLES as readonly string[]).includes(role);
}

/** Learner + staff surfaces of HSK Academy (not tutors / tutor_students). */
export function canAccessHskAcademy(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return (
    normalized === 'admin' || normalized === 'teacher' || normalized === 'student'
  );
}

/** Exam Content Studio / HSK bank management. */
export function canManageHskAcademyContent(role: string | undefined | null): boolean {
  const normalized = normalizeRole(role);
  return normalized === 'admin' || normalized === 'teacher';
}
