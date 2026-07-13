/** Label when a record has no linked student (deleted or never assigned). */
export const DELETED_STUDENT_LABEL = 'Удалённый ученик';

export function resolveStudentNameById(studentId, students = []) {
  if (!studentId) {
    return null;
  }
  return students.find((student) => student.id === studentId)?.name ?? null;
}

export function resolveStudentLabel(studentId, students = []) {
  const name = resolveStudentNameById(studentId, students);
  if (name) {
    return name;
  }
  if (studentId === null || studentId === undefined || studentId === '') {
    return DELETED_STUDENT_LABEL;
  }
  return DELETED_STUDENT_LABEL;
}

export function resolvePaymentStudentLabel(payment, students = []) {
  if (payment?.student_name) {
    return payment.student_name;
  }
  return resolveStudentLabel(payment?.student_id ?? payment?.studentId, students);
}

export function resolveLessonStudentLabel(lesson, students = []) {
  if (lesson?.student_names?.length) {
    return lesson.student_names
      .map((name) => name || DELETED_STUDENT_LABEL)
      .join(', ');
  }
  if (lesson?.student_name) {
    return lesson.student_name;
  }

  const studentIds = lesson?.student_ids?.length
    ? lesson.student_ids
    : lesson?.student_id || lesson?.primary_student_id
      ? [lesson.student_id || lesson.primary_student_id]
      : [];

  if (studentIds.length > 0) {
    const labels = studentIds.map((id) => resolveStudentLabel(id, students));
    if (labels.some(Boolean)) {
      return labels.join(', ');
    }
  }

  if (
    lesson?.lesson_type === 'individual'
    || lesson?.lessonType === 'individual'
    || lesson?.primary_student_id === null
    || lesson?.primaryStudentId === null
  ) {
    return DELETED_STUDENT_LABEL;
  }

  return '—';
}

export function resolveLessonStudentNames(lesson, students = []) {
  if (lesson?.student_names?.length) {
    return lesson.student_names.map((name) => name || DELETED_STUDENT_LABEL);
  }
  const label = resolveLessonStudentLabel(lesson, students);
  return label === '—' ? [] : [label];
}
