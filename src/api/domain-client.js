import { apiFetch } from './http';

const SYSTEM_RECORD_FIELDS = new Set(['id', 'created_date', 'updated_date']);

const FIELD_ALIASES = {
  course_id: 'courseTemplateId',
  parent_folder_id: 'parentId',
  assigned_teacher: 'assignedTeacherId',
  user_id: 'userId',
  teacher_id: 'teacherId',
  student_id: 'studentId',
  material_id: 'materialId',
  folder_id: 'folderId',
  granted_by_role: 'grantedByRole',
  sort_order: 'sortOrder',
  is_active: 'isActive',
  course_name: 'name',
  course_type: 'courseType',
  total_lessons: 'totalLessons',
  label: 'name',
  lessons: 'lessonsCount',
  file_url: 'fileUrl',
  file_type: 'fileType',
  external_link: 'externalLink',
  block_name: 'blockName',
  payment_date: 'paymentDate',
  start_time: 'startTime',
  lesson_balance: 'lessonBalance',
  start_date: 'startDate',
  telegram_id: 'telegramId',
};

export function snakeToCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
}

export function recordToEntityPayload(input) {
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

export function sortRecords(records, sortField) {
  if (!sortField || !Array.isArray(records)) {
    return records;
  }

  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;

  return [...records].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}

export function createDomainClient(basePath, options = {}) {
  const { listPath = basePath, filterPath = `${basePath}/filter` } = options;

  return {
    list(sortField, limit) {
      return apiFetch(listPath).then((data) => {
        let rows = Array.isArray(data) ? data : [];
        rows = sortRecords(rows, sortField);
        if (limit) {
          rows = rows.slice(0, Number(limit));
        }
        return rows;
      });
    },

    filter(query) {
      return apiFetch(filterPath, {
        method: 'POST',
        body: JSON.stringify({ where: query }),
      });
    },

    create(data) {
      return apiFetch(basePath, {
        method: 'POST',
        body: JSON.stringify(recordToEntityPayload(data)),
      });
    },

    update(id, data) {
      return apiFetch(`${basePath}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(recordToEntityPayload(data)),
      });
    },

    delete(id) {
      return apiFetch(`${basePath}/${id}`, { method: 'DELETE' });
    },
  };
}
