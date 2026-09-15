export const SALES_DIARY_STATUSES = [
  'new',
  'in_progress',
  'contacted',
  'negotiations',
  'proposal_sent',
  'thinking',
  'contract_signed',
  'refused',
  'unreachable',
  'postponed',
];

export const SALES_DIARY_STATUS_LABELS = {
  new: 'Новая',
  in_progress: 'В работе',
  contacted: 'Связались',
  negotiations: 'Переговоры',
  proposal_sent: 'Предложение отправлено',
  thinking: 'Думают',
  contract_signed: 'Договор заключён',
  refused: 'Отказ',
  unreachable: 'Не удалось связаться',
  postponed: 'Отложено',
};

export const SALES_DIARY_STATUS_VARIANT = {
  new: 'muted',
  in_progress: 'info',
  contacted: 'info',
  negotiations: 'warning',
  proposal_sent: 'warning',
  thinking: 'warning',
  contract_signed: 'success',
  refused: 'destructive',
  unreachable: 'destructive',
  postponed: 'muted',
};

export const SALES_DIARY_CONTACT_TYPES = [
  'call',
  'email',
  'meeting',
  'messenger',
  'other',
];

export const SALES_DIARY_CONTACT_LABELS = {
  call: 'Звонок',
  email: 'Письмо',
  meeting: 'Встреча',
  messenger: 'Мессенджер',
  other: 'Другое',
};

export const SALES_DIARY_FILTERS = [
  { id: 'all', label: 'Все' },
  { id: 'today', label: 'На сегодня' },
  { id: 'overdue', label: 'Просроченные' },
  { id: 'in_work', label: 'В работе' },
  { id: 'contract_signed', label: 'Договор заключён' },
  { id: 'refused', label: 'Отказ' },
];

export function formatDiaryDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatDiaryDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
