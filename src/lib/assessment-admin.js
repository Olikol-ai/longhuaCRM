import { unwrapItems } from '@/lib/assessment-ui';

export const LIFECYCLE_STATUS_LABEL = {
  draft: 'Черновик',
  /** ACTIVE in domain terms; DB value remains `published` for compatibility. */
  published: 'Активен',
  archived: 'В архиве',
};

export const QUESTION_TYPE_LABEL = {
  single_choice: 'Один ответ',
  multiple_choice: 'Несколько ответов',
  listening: 'Аудирование',
  short_text: 'Короткий ответ',
};

export const QUESTION_TYPES = [
  'single_choice',
  'multiple_choice',
  'listening',
  'short_text',
];

export const ATTACHMENT_KIND_LABEL = {
  image: 'Изображение',
  audio: 'Аудио',
  pdf: 'PDF',
  document: 'Документ',
};

export const RESULT_STATUS_LABEL = {
  processing: 'Обработка',
  pending_review: 'Ожидает проверки',
  passed: 'Сдан',
  failed: 'Не сдан',
  invalidated: 'Аннулирован',
};

export const EVALUATION_TYPE_LABEL = {
  automatic: 'Автоматическая',
  manual: 'Ручная',
  mixed: 'Смешанная',
};

export function lifecycleBadgeClass(status) {
  switch (status) {
    case 'published':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'archived':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'draft':
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }
}

export function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

export { unwrapItems };

export function guessAttachmentKind(file) {
  const mime = (file?.type || '').toLowerCase();
  const name = (file?.name || '').toLowerCase();
  if (mime.startsWith('image/') || /\.(png|jpe?g|gif|webp|svg)$/.test(name)) return 'image';
  if (mime.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/.test(name)) return 'audio';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  return 'document';
}

export function needsAnswerOptions(type) {
  return (
    type === 'single_choice' ||
    type === 'multiple_choice' ||
    type === 'listening' ||
    type === 'reading'
  );
}

export function validateQuestionForm({ type, stem, answers }) {
  if (!stem?.trim()) return 'Введите текст вопроса';
  if (!needsAnswerOptions(type)) return null;
  const rows = (answers || []).filter((a) => a.text?.trim());
  if (rows.length < 2) return 'Добавьте минимум два варианта ответа';
  if (!rows.some((a) => a.is_correct)) return 'Отметьте хотя бы один правильный ответ';
  if (type === 'single_choice' || type === 'listening' || type === 'reading') {
    const correct = rows.filter((a) => a.is_correct);
    if (correct.length !== 1) return 'Для этого типа нужен ровно один правильный ответ';
  }
  return null;
}

export function slugifySectionKey(title, fallbackIndex = 0) {
  const base = String(title || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
  return base || `section_${fallbackIndex + 1}`;
}

export const DEFAULT_EXAM_RULE = {
  duration_minutes: 60,
  max_attempts: 1,
  allow_retake: false,
  retake_policy: 'best',
  allow_review: false,
  show_result_after_submit: true,
  show_correct_answers: 'never',
  auto_submit_on_timeout: true,
  allow_pause: false,
  randomize_questions: true,
  randomize_answers: true,
  passing_mode: 'percent',
  pass_score_percent: 60,
  allow_navigation: true,
};

export const ASSIGNMENT_STATUS_LABEL = {
  draft: 'Черновик',
  scheduled: 'Запланирован',
  active: 'Активен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

export const ASSIGNMENT_TARGET_LABEL = {
  student: 'Ученик',
  group: 'Группа',
  course: 'Курс',
  corporate_group: 'Корп. группа',
  teacher: 'Преподаватель',
  public: 'Публичный',
};

export const ASSIGNMENT_TARGET_OPTIONS = [
  'student',
  'group',
  'course',
  'corporate_group',
];

export function assignmentStatusBadgeClass(status) {
  switch (status) {
    case 'active':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'scheduled':
      return 'bg-brand-muted text-brand dark:bg-brand-soft/50 dark:text-brand';
    case 'completed':
      return 'bg-brand-muted text-brand-hover dark:bg-brand-soft/50 dark:text-brand';
    case 'cancelled':
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
    case 'draft':
    default:
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
  }
}

export function resultBadgeClass(status) {
  switch (status) {
    case 'passed':
      return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200';
    case 'failed':
      return 'bg-rose-100 text-rose-800 dark:bg-rose-950/50 dark:text-rose-200';
    case 'pending_review':
    case 'processing':
      return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
}

export function displayPersonName(row) {
  if (!row) return '—';
  const name = String(row.name ?? row.full_name ?? row.fullName ?? '').trim();
  if (name) {
    return name;
  }
  if (row.last_name || row.first_name || row.lastName || row.firstName) {
    return [row.last_name ?? row.lastName, row.first_name ?? row.firstName]
      .filter(Boolean)
      .join(' ');
  }
  return row.email || row.id || '—';
}

export function toDatetimeLocalValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function fromDatetimeLocalValue(value) {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

export function formatDurationSeconds(seconds) {
  if (seconds == null || Number.isNaN(Number(seconds))) return '—';
  const total = Math.max(0, Math.floor(Number(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) return `${h}ч ${m}м ${s}с`;
  if (m > 0) return `${m}м ${s}с`;
  return `${s}с`;
}
