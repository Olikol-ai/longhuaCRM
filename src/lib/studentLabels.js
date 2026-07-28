/** Label when a record has no linked student (deleted or never assigned). */
export const DELETED_STUDENT_LABEL = 'Удалённый ученик';

/**
 * Display name: Student.name is SSOT (admin card / profile).
 * Fall back to last_name + first_name only when name is empty.
 * Never invent placeholders like "Unknown" / "Student" / generic test labels.
 */
export function formatStudentDisplayName(student) {
  if (!student || typeof student !== 'object') {
    return null;
  }
  const name = String(student.name ?? '').trim();
  if (name) {
    return name;
  }
  return null;
}

export function resolveStudentNameById(studentId, students = []) {
  if (!studentId) {
    return null;
  }
  const student = students.find((row) => row.id === studentId);
  return formatStudentDisplayName(student);
}

/**
 * Prefer live Student list over any denormalized attendance label.
 */
export function resolveStudentLabel(studentId, students = [], attendanceRow = null) {
  const name = resolveStudentNameById(studentId, students);
  if (name) {
    return name;
  }
  const fromAttendance = formatStudentDisplayName(attendanceRow)
    || String(attendanceRow?.student_name ?? attendanceRow?.studentName ?? '').trim();
  if (fromAttendance) {
    return fromAttendance;
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

function lessonStudentIds(lesson) {
  if (lesson?.student_ids?.length) {
    return lesson.student_ids;
  }
  if (lesson?.studentIds?.length) {
    return lesson.studentIds;
  }
  if (lesson?.tutor_student_ids?.length) {
    return lesson.tutor_student_ids;
  }
  if (lesson?.tutorStudentIds?.length) {
    return lesson.tutorStudentIds;
  }
  const primary =
    lesson?.primary_student_id ||
    lesson?.primaryStudentId ||
    lesson?.primary_tutor_student_id ||
    lesson?.primaryTutorStudentId ||
    lesson?.primary_teacher_student_contact_id ||
    lesson?.primaryTeacherStudentContactId ||
    lesson?.teacher_student_contact_id ||
    lesson?.teacherStudentContactId;
  return primary ? [primary] : [];
}

/**
 * Prefer live Student profiles when the students list is available.
 * Otherwise use API-attached student_names (also derived from Student.name).
 */
export function resolveLessonStudentLabel(lesson, students = []) {
  const studentIds = lessonStudentIds(lesson);

  if (studentIds.length > 0 && students.length > 0) {
    const labels = studentIds
      .map((id) => resolveStudentNameById(id, students))
      .filter(Boolean);
    if (labels.length > 0) {
      return labels.join(', ');
    }
  }

  if (lesson?.student_names?.length) {
    return lesson.student_names
      .map((name) => name || DELETED_STUDENT_LABEL)
      .filter(Boolean)
      .join(', ');
  }
  if (lesson?.studentNames?.length) {
    return lesson.studentNames
      .map((name) => name || DELETED_STUDENT_LABEL)
      .filter(Boolean)
      .join(', ');
  }
  if (lesson?.student_name) {
    return lesson.student_name;
  }
  if (lesson?.studentName) {
    return lesson.studentName;
  }

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
  const studentIds = lessonStudentIds(lesson);
  if (studentIds.length > 0 && students.length > 0) {
    const labels = studentIds.map((id) => {
      const name = resolveStudentNameById(id, students);
      return name || DELETED_STUDENT_LABEL;
    });
    if (labels.some((label) => label !== DELETED_STUDENT_LABEL)) {
      return labels;
    }
  }

  if (lesson?.student_names?.length) {
    return lesson.student_names.map((name) => name || DELETED_STUDENT_LABEL);
  }
  if (lesson?.studentNames?.length) {
    return lesson.studentNames.map((name) => name || DELETED_STUDENT_LABEL);
  }
  const label = resolveLessonStudentLabel(lesson, students);
  return label === '—' ? [] : [label];
}
