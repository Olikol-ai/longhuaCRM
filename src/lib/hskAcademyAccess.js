/**
 * HSK Academy / Exam Content — Longhua school only.
 * Tutors and tutor_students use Assessment, not Academy.
 */

export const HSK_ACADEMY_ROLES = ['admin', 'teacher', 'student'];

/** Exam Content Studio + HSK bank authoring */
export const HSK_ACADEMY_STAFF_ROLES = ['admin', 'teacher'];

export function canAccessHskAcademy(role) {
  return HSK_ACADEMY_ROLES.includes(role);
}

export function canManageHskAcademyContent(role) {
  return HSK_ACADEMY_STAFF_ROLES.includes(role);
}
