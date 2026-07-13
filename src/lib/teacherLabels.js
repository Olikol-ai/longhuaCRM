/** Label when a lesson/series has no teacher (deleted or never assigned). */
export const DELETED_LESSON_TEACHER_LABEL = 'Преподаватель удалён';

/** Label when a student/group has no assigned teacher. */
export const UNASSIGNED_TEACHER_LABEL = 'Не назначен';

/** Label when a teacher payment row has no linked teacher profile. */
export const DELETED_TEACHER_PAYMENT_LABEL = 'Удалённый преподаватель';

export function resolveTeacherNameById(teacherId, teachers = []) {
  if (!teacherId) {
    return null;
  }
  return teachers.find((teacher) => teacher.id === teacherId)?.name ?? null;
}

export function resolveAssignedTeacherLabel(teacherId, teachers = []) {
  const name = resolveTeacherNameById(teacherId, teachers);
  if (name) {
    return name;
  }
  return UNASSIGNED_TEACHER_LABEL;
}

export function resolveLessonTeacherLabel(lesson, teachers = []) {
  if (lesson?.teacher_name) {
    return lesson.teacher_name;
  }
  const name = resolveTeacherNameById(lesson?.teacher_id, teachers);
  if (name) {
    return name;
  }
  return DELETED_LESSON_TEACHER_LABEL;
}

export function resolveSeriesTeacherLabel(series, teachers = []) {
  const name = resolveTeacherNameById(series?.teacher_id, teachers);
  if (name) {
    return name;
  }
  return DELETED_LESSON_TEACHER_LABEL;
}

export function resolveTeacherPaymentLabel(teacherId, teachers = []) {
  const name = resolveTeacherNameById(teacherId, teachers);
  if (name) {
    return name;
  }
  return DELETED_TEACHER_PAYMENT_LABEL;
}
