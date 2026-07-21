import { StreamableFile } from '@nestjs/common';

/** Convert camelCase keys to snake_case for API responses (frontend contract). */
export function camelToSnake(key: string): string {
  return key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/** Legacy frontend field names (stable API contract). */
const API_FIELD_ALIASES: Record<string, string> = {
  assignedTeacherId: 'assigned_teacher',
  courseTemplateId: 'course_id',
  // Explicit contract: frontend always uses telegram_id (not telegram_chat_id)
  telegramId: 'telegram_id',
};

const FILTER_FIELD_ALIASES: Record<string, string> = {
  assigned_teacher: 'assignedTeacherId',
  course_id: 'courseId',
  registration_number: 'registrationNumber',
  teacher_id: 'teacherId',
  student_id: 'studentId',
  user_id: 'userId',
  primary_student_id: 'primaryStudentId',
  group_id: 'groupId',
  lesson_id: 'lessonId',
  shop_item_id: 'shopItemId',
};

/** PostgreSQL `time` often serializes as HH:MM:SS — UI only needs HH:MM. */
const CLOCK_TIME_RE = /^(\d{1,2}):(\d{2})(?::\d{2}(?:\.\d+)?)?$/;

const CLOCK_TIME_KEYS = new Set([
  'startTime',
  'endTime',
  'timeFrom',
  'timeTo',
  'start_time',
  'end_time',
  'time_from',
  'time_to',
  'from',
  'to',
]);

export function formatClockTime(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  const match = CLOCK_TIME_RE.exec(value.trim());
  if (!match) return value;
  const hours = String(Number(match[1])).padStart(2, '0');
  const minutes = match[2];
  return `${hours}:${minutes}`;
}

function entityFieldToApiKey(key: string): string {
  return API_FIELD_ALIASES[key] ?? camelToSnake(key);
}

export function entityToApiRecord(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
  if (value instanceof StreamableFile) return value;
  if (Buffer.isBuffer(value)) return value;
  if (Array.isArray(value)) return value.map((item) => entityToApiRecord(item, seen));
  if (typeof value !== 'object') return value;

  if (seen.has(value as object)) {
    return undefined;
  }
  seen.add(value as object);

  const record = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(record)) {
    if (key === 'passwordHash' || key === 'verificationCodeHash') continue;
    if (key === 'assignedTeacher') continue;
    if (key === 'folder' || key === 'material' || key === 'lesson') continue;
    /**
     * Skip nested TypeORM relation objects when the FK id is already present
     * (avoids circular dumps on Lesson/GroupMember/etc.).
     * Do NOT skip intentional payload fields like GroupsService.getWorkspace().group
     * where the parent object has no groupId/seriesId/teacherId FK.
     */
    if (
      (key === 'group' && ('groupId' in record || 'group_id' in record))
      || (key === 'series' && ('seriesId' in record || 'series_id' in record))
      || (key === 'teacher' && ('teacherId' in record || 'teacher_id' in record))
      || (key === 'primaryStudent' && ('primaryStudentId' in record || 'primary_student_id' in record))
    ) {
      continue;
    }
    if (key.startsWith('__')) continue;
    let mapped = entityToApiRecord(val, seen);
    if (mapped === undefined) {
      continue;
    }
    if (CLOCK_TIME_KEYS.has(key)) {
      mapped = formatClockTime(mapped);
    }
    out[entityFieldToApiKey(key)] = mapped;
    // Legacy FE contract: individual lessons were exposed as student_id.
    if (key === 'primaryStudentId') {
      out.student_id = mapped;
    }
  }
  return out;
}

/** Map frontend snake_case filter keys to entity camelCase for TypeORM. */
export function filterToEntityWhere(where: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(where)) {
    const mapped = FILTER_FIELD_ALIASES[key];
    const camel = mapped ?? key.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
    out[camel] = val;
  }
  return out;
}
