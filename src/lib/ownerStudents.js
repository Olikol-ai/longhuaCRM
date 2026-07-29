/**
 * Helpers for the unified teacher/tutor "Ученики" section.
 * Registered = has User account; manual = CRM/contact/notebook without User.
 */

export const STUDENT_KIND = {
  REGISTERED: 'registered',
  MANUAL: 'manual',
};

export const STUDENT_KIND_LABEL = {
  registered: 'Зарегистрированный',
  manual: 'Добавлен вручную',
};

export const STUDENT_STATUS_LABEL = {
  active: 'Активен',
  inactive: 'Неактивен',
  paused: 'Пауза',
  pending_assignment: 'Ожидает назначения',
};

export function normalizePersonName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function hasUserAccount(row) {
  return Boolean(row?.user_id || row?.userId);
}

export function displayName(row) {
  return (
    row?.name ||
    row?.full_name ||
    [row?.last_name || row?.lastName, row?.first_name || row?.firstName]
      .filter(Boolean)
      .join(' ') ||
    row?.email ||
    'Без имени'
  );
}

/**
 * Build a unified list for teacher or tutor.
 * @param {'teacher'|'tutor'} ownerType
 * @param {{ contacts?: any[], schoolStudents?: any[], tutorStudents?: any[] }} sources
 */
export function buildOwnerStudentRows(ownerType, sources = {}) {
  const contacts = Array.isArray(sources.contacts) ? sources.contacts : [];
  const schoolStudents = Array.isArray(sources.schoolStudents)
    ? sources.schoolStudents
    : [];
  const tutorStudents = Array.isArray(sources.tutorStudents)
    ? sources.tutorStudents
    : [];

  const rows = [];

  if (ownerType === 'teacher') {
    for (const student of schoolStudents) {
      const registered = hasUserAccount(student);
      rows.push({
        key: `school:${student.id}`,
        id: student.id,
        source: 'school_student',
        kind: registered ? STUDENT_KIND.REGISTERED : STUDENT_KIND.MANUAL,
        name: displayName(student),
        phone: student.phone || null,
        email: student.email || null,
        status: student.status || 'active',
        lesson_balance: student.lesson_balance ?? student.lessonBalance ?? 0,
        user_id: student.user_id || student.userId || null,
        raw: student,
        // School CRM students are managed by admin / assignment flow, not this notebook.
        canEdit: false,
        canDelete: false,
        canEditBalance: false,
        usesContactDetail: false,
      });
    }

    for (const contact of contacts) {
      rows.push({
        key: `contact:${contact.id}`,
        id: contact.id,
        source: 'contact',
        kind: STUDENT_KIND.MANUAL,
        name: displayName(contact),
        phone: contact.phone || null,
        email: null,
        status: contact.status || 'active',
        lesson_balance: contact.lesson_balance ?? contact.lessonBalance ?? 0,
        user_id: null,
        last_lesson_date: contact.last_lesson_date ?? contact.lastLessonDate ?? null,
        last_lesson_start_time:
          contact.last_lesson_start_time ?? contact.lastLessonStartTime ?? null,
        raw: contact,
        canEdit: true,
        canDelete: true,
        canEditBalance: true,
        usesContactDetail: true,
      });
    }
  } else {
    const contactNameSet = new Set(
      contacts.map((row) => normalizePersonName(displayName(row))).filter(Boolean),
    );

    for (const student of tutorStudents) {
      const registered = hasUserAccount(student);
      if (!registered && contactNameSet.has(normalizePersonName(displayName(student)))) {
        // Twin notebook entry created for homework; contact is the schedule/balance card.
        continue;
      }
      rows.push({
        key: `tutor_student:${student.id}`,
        id: student.id,
        source: 'tutor_student',
        kind: registered ? STUDENT_KIND.REGISTERED : STUDENT_KIND.MANUAL,
        name: displayName(student),
        phone: student.phone || null,
        email: student.email || null,
        status: student.status || 'active',
        lesson_balance: null,
        user_id: student.user_id || student.userId || null,
        raw: student,
        canEdit: !registered,
        canDelete: !registered,
        canEditBalance: false,
        usesContactDetail: false,
      });
    }

    for (const contact of contacts) {
      rows.push({
        key: `contact:${contact.id}`,
        id: contact.id,
        source: 'contact',
        kind: STUDENT_KIND.MANUAL,
        name: displayName(contact),
        phone: contact.phone || null,
        email: null,
        status: contact.status || 'active',
        lesson_balance: contact.lesson_balance ?? contact.lessonBalance ?? 0,
        user_id: null,
        last_lesson_date: contact.last_lesson_date ?? contact.lastLessonDate ?? null,
        last_lesson_start_time:
          contact.last_lesson_start_time ?? contact.lastLessonStartTime ?? null,
        raw: contact,
        canEdit: true,
        canDelete: true,
        canEditBalance: true,
        usesContactDetail: true,
      });
    }
  }

  return rows.sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), 'ru', {
      sensitivity: 'base',
    }),
  );
}

export function filterOwnerStudentRows(rows, { tab = 'all', query = '' } = {}) {
  const q = normalizePersonName(query);
  return (Array.isArray(rows) ? rows : []).filter((row) => {
    if (tab === 'registered' && row.kind !== STUDENT_KIND.REGISTERED) return false;
    if (tab === 'manual' && row.kind !== STUDENT_KIND.MANUAL) return false;
    if (!q) return true;
    const hay = [row.name, row.phone, row.email]
      .filter(Boolean)
      .map((value) => normalizePersonName(value))
      .join(' ');
    return hay.includes(q);
  });
}
