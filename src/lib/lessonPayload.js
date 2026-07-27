function snakeToCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

const FIELD_ALIASES = {
  teacher_id: 'teacherId',
  tutor_id: 'tutorId',
  student_id: 'studentId',
  primary_student_id: 'primaryStudentId',
  tutor_student_id: 'tutorStudentId',
  primary_tutor_student_id: 'primaryTutorStudentId',
  group_id: 'groupId',
  series_id: 'seriesId',
  start_time: 'startTime',
  lesson_type: 'lessonType',
  lesson_format: 'lessonFormat',
  meeting_link: 'meetingLink',
};

const SYSTEM_RECORD_FIELDS = new Set(['id', 'created_date', 'updated_date']);

/** Denormalized / legacy fields that must never be sent to Nest lesson DTOs. */
const LESSON_STRIP_KEYS = new Set([
  'teacherName',
  'teacherFirstName',
  'teacherLastName',
  'studentId',
  'studentIds',
  'studentName',
  'studentNames',
  'studentFirstName',
  'studentLastName',
  'isRecurring',
  'recurringGroupId',
]);

function recordToEntityPayload(input) {
  const payload = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (SYSTEM_RECORD_FIELDS.has(key) || value === undefined) {
      continue;
    }
    const mappedKey = FIELD_ALIASES[key] ?? snakeToCamel(key);
    payload[mappedKey] = value;
  }
  return payload;
}

/**
 * Map UI snake_case records onto CreateLessonDto / UpdateLessonDto.
 * Critical: student_id must become primaryStudentId (not studentId).
 * Tutor lessons: tutor_student_id → primaryTutorStudentId.
 */
export function toLessonWritePayload(input) {
  const payload = recordToEntityPayload(input);

  if (!payload.primaryTutorStudentId) {
    const tutorStudent =
      payload.tutorStudentId ??
      input?.primary_tutor_student_id ??
      input?.primaryTutorStudentId ??
      input?.tutor_student_id ??
      input?.tutorStudentId;
    if (tutorStudent) {
      payload.primaryTutorStudentId = tutorStudent;
    }
  }

  if (!payload.primaryStudentId && !payload.primaryTutorStudentId) {
    const legacyStudent =
      payload.studentId ??
      input?.primary_student_id ??
      input?.primaryStudentId ??
      input?.student_id ??
      input?.studentId;
    if (legacyStudent) {
      payload.primaryStudentId = legacyStudent;
    }
  }

  // Tutor-owned lessons must never send school student ids.
  if (payload.tutorId && payload.primaryTutorStudentId) {
    delete payload.primaryStudentId;
  }

  delete payload.studentId;
  delete payload.tutorStudentId;

  for (const key of LESSON_STRIP_KEYS) {
    delete payload[key];
  }

  if (payload.groupId === '' || payload.groupId == null) {
    delete payload.groupId;
  }
  if (payload.primaryStudentId === '' || payload.primaryStudentId == null) {
    delete payload.primaryStudentId;
  }
  if (payload.primaryTutorStudentId === '' || payload.primaryTutorStudentId == null) {
    delete payload.primaryTutorStudentId;
  }

  // Group lessons are driven by membership; do not also send a primary student.
  if (payload.groupId) {
    delete payload.primaryStudentId;
    delete payload.primaryTutorStudentId;
    if (!payload.lessonType) {
      payload.lessonType = 'group';
    }
  } else if ((payload.primaryStudentId || payload.primaryTutorStudentId) && !payload.lessonType) {
    payload.lessonType = 'individual';
  }

  return payload;
}
