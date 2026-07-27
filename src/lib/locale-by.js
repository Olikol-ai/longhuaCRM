/**
 * User-facing Russian (Belarus) labels.
 * Technical role/status keys stay English in code & API — only display text is localized.
 */

export const ROLE_LABEL = {
  admin: 'Администратор',
  teacher: 'Преподаватель',
  tutor: 'Репетитор',
  student: 'Ученик',
  tutor_student: 'Ученик репетитора',
  pending: 'Ожидает роли',
  user: 'Без роли',
};

/** Profile / entity lifecycle (users, teachers, tutors, students, groups). */
export const ENTITY_STATUS_LABEL = {
  active: 'Активен',
  inactive: 'Неактивен',
  pending: 'Ожидает',
  paused: 'Пауза',
  blocked: 'Заблокирован',
  draft: 'Черновик',
  archived: 'В архиве',
};

export const LESSON_STATUS_LABEL = {
  planned: 'Запланировано',
  completed: 'Проведено',
  cancelled: 'Отменено',
  rescheduled: 'Перенесено',
  missed: 'Пропущено',
  missed_no_notice: 'Пропущено без уведомления',
};

export const ATTENDANCE_STATUS_LABEL = {
  enrolled: 'Записан',
  attended: 'Присутствовал',
  missed: 'Пропуск',
  missed_no_notice: 'Пропуск без уведомления',
  cancelled: 'Отменено',
};

export const SERIES_STATUS_LABEL = {
  active: 'Активен',
  inactive: 'Неактивен',
  completed: 'Завершён',
  cancelled: 'Отменён',
  paused: 'Пауза',
  draft: 'Черновик',
};

export const PAYMENT_STATUS_LABEL = {
  pending: 'Ожидает оплаты',
  paid: 'Оплачено',
  failed: 'Ошибка оплаты',
  cancelled: 'Отменено',
  refunded: 'Возврат',
};

/** Resolve a display label; never show raw technical keys when a map is known. */
export function localizeLabel(map, value, fallback = '—') {
  if (value == null || value === '') return fallback;
  const key = String(value);
  if (map && Object.prototype.hasOwnProperty.call(map, key)) {
    return map[key];
  }
  return fallback === undefined ? key : fallback;
}

export function localizeRole(role) {
  return localizeLabel(ROLE_LABEL, role, 'Без роли');
}

/** Alias for UI — never render raw role keys from the API. */
export function getRoleLabel(role) {
  return localizeRole(role);
}

export const ROLE_BADGE_CLASS = {
  admin: 'bg-brand-muted text-brand',
  teacher: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300',
  tutor: 'bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300',
  student: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  tutor_student: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300',
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300',
  user: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
};

export function getRoleBadgeClass(role) {
  const key = String(role ?? '');
  return ROLE_BADGE_CLASS[key] || ROLE_BADGE_CLASS.pending;
}

export function localizeEntityStatus(status) {
  return localizeLabel(ENTITY_STATUS_LABEL, status, 'Неизвестно');
}

export function localizeLessonStatus(status) {
  return localizeLabel(LESSON_STATUS_LABEL, status, 'Статус неизвестен');
}

export function localizeAttendanceStatus(status) {
  return localizeLabel(ATTENDANCE_STATUS_LABEL, status, 'Статус неизвестен');
}

export function localizeSeriesStatus(status) {
  return localizeLabel(SERIES_STATUS_LABEL, status, localizeEntityStatus(status));
}

export function localizePaymentStatus(status) {
  return localizeLabel(PAYMENT_STATUS_LABEL, status, 'Статус неизвестен');
}
