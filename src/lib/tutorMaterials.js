/** Synthetic course id for tutor personal library (no school course_templates). */
export const TUTOR_LIBRARY_COURSE_ID = 'tutor-personal-library';

export function isTutorLibraryCourseId(courseId) {
  return !courseId || courseId === TUTOR_LIBRARY_COURSE_ID;
}
