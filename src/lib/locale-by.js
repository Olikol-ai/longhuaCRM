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
