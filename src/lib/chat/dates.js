const MONTHS = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next.getTime();
}

export function formatMessageTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatChatListTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const day = startOfDay(date);
  const today = startOfDay(now);
  if (day === today) return formatMessageTime(date);
  if (day === today - 86400000) return 'вчера';
  if (date.getFullYear() === now.getFullYear()) {
    return `${date.getDate()} ${MONTHS[date.getMonth()].slice(0, 3)}.`;
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

export function formatDateSeparator(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const day = startOfDay(date);
  const today = startOfDay(now);
  if (day === today) return 'Сегодня';
  if (day === today - 86400000) return 'Вчера';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}${date.getFullYear() !== now.getFullYear() ? ` ${date.getFullYear()}` : ''}`;
}

export function sameCalendarDay(a, b) {
  if (!a || !b) return false;
  return startOfDay(a) === startOfDay(b);
}
