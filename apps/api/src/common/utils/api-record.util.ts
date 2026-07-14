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

function entityFieldToApiKey(key: string): string {
  return API_FIELD_ALIASES[key] ?? camelToSnake(key);
}

export function entityToApiRecord(
  value: unknown,
  seen: WeakSet<object> = new WeakSet(),
): unknown {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return value.toISOString();
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
    if (key.startsWith('__')) continue;
    const mapped = entityToApiRecord(val, seen);
    if (mapped !== undefined) {
      out[entityFieldToApiKey(key)] = mapped;
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
