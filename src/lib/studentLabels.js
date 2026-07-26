/** Label when a record has no linked student (deleted or never assigned). */
export const DELETED_STUDENT_LABEL = 'Удалённый ученик';

/**
 * Display name: last_name + first_name (project convention), then composed name.
 * Never invent placeholders like "Unknown" / "Student" / generic test labels.
 */
export function formatStudentDisplayName(student) {
  if (!student || typeof student !== 'object') {
    return null;
  }
  const first = String(student.first_name ?? student.firstName ?? '').trim();
  const last = String(student.last_name ?? student.lastName ?? '').trim();
  const fromParts = [last, first].filter(Boolean).join(' ').trim();
  if (fromParts) {
    return fromParts;
  }
  const name = String(student.name ?? '').trim();
  return name || null;
}

export function resolveStudentNameById(studentId, students = []) {
  if (!studentId) {
    return null;
  }
  const student = students.find((row) => row.id === studentId);
  return formatStudentDisplayName(student);
}

export function resolveStudentLabel(studentId, students = [], attendanceRow = null) {
  const fromAttendance = formatStudentDisplayName(attendanceRow)
    || String(attendanceRow?.student_name ?? attendanceRow?.studentName ?? '').trim();
  if (fromAttendance) {
    return fromAttendance;
  }
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
      .filter(Boolean)
      .join(', ');
  }
  if (lesson?.student_name) {
    return lesson.student_name;
  }

  const studentIds = lesson?.student_ids?.length
    ? lesson.student_ids
    : lesson?.primary_student_id || lesson?.primaryStudentId
      ? [lesson.primary_student_id || lesson.primaryStudentId]
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
