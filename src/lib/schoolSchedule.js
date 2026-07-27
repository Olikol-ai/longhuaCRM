/**
 * Admin school schedule shows only teacher-owned lessons.
 * Tutor lessons live in the tutor workspace and must not mix in.
 */
export function isSchoolTeacherLesson(lesson) {
  if (!lesson || typeof lesson !== 'object') return false;
  const teacherId = lesson.teacher_id ?? lesson.teacherId;
  return Boolean(teacherId);
}

export function filterSchoolTeacherLessons(lessons) {
  if (!Array.isArray(lessons)) return [];
  return lessons.filter(isSchoolTeacherLesson);
}
