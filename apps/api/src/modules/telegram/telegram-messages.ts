/**
 * Canonical user-facing Telegram copy + keyboards.
 * CRM database remains the only source of truth for user data.
 *
 * Navigation uses InlineKeyboardMarkup only (under the message).
 * ReplyKeyboardMarkup is intentionally not used for menus — sticky bottom
 * keyboards hide the text input and clutter the chat.
 */

import type { TelegramInlineButton } from './telegram.gateway';

export const TELEGRAM_BTN = {
  lessons: '📚 Мои занятия',
  balance: '💰 Баланс',
  settings: '🔔 Уведомления',
  profile: '👤 Профиль',
  help: '❓ Помощь',
  back: '← Назад',
  backToMenu: 'Вернуться в меню',
  /** Legacy reply-keyboard labels (still handled if a stale keyboard is tapped) */
  lessonsLegacy: '📚 Мои ближайшие уроки',
  settingsLegacy: '🔔 Настройки уведомлений',
  statusLegacy: '⚙️ Статус подключения',
  balanceLegacy: '💰 Мой баланс',
} as const;

export const TELEGRAM_CB = {
  main: 'menu:main',
  lessons: 'menu:lessons',
  balance: 'menu:balance',
  settings: 'menu:settings',
  profile: 'menu:profile',
  help: 'menu:help',
  /** Alias kept for older callback payloads */
  status: 'menu:status',
  toggle24h: 'settings:toggle_24h',
  toggle3h: 'settings:toggle_3h',
} as const;

export const TELEGRAM_MSG = {
  startLinked:
    '✅ Longhua Academy подключён\n\nВыберите действие в меню ниже:',
  startNotLinked:
    'Здравствуйте!\n\nTelegram ещё не подключён.\nОткройте профиль в личном кабинете и нажмите «Привязать Telegram».',
  linkFailed:
    'Ссылка больше не действует.\nСоздайте новую в профиле личного кабинета.',
  confirmed: '✅ Занятие подтверждено',
  declined: '❌ Занятие отменено',
  callbackConfirmed: 'Подтверждено',
  callbackDeclined: 'Отменено',
  noUpcomingLessons: 'Ближайших уроков пока нет.',
  notLinkedShort:
    'Telegram не подключён.\nОткройте профиль и нажмите «Привязать Telegram».',
  alreadyConfirmed: 'Этот урок уже подтверждён.',
  alreadyDeclined: 'Этот урок уже отменён.',
  staleButton: 'Эта кнопка больше не действует.',
  saveFailed: 'Не удалось сохранить. Попробуйте ещё раз.',
  unknownAction: 'Действие недоступно.',
  help: [
    '❓ Помощь',
    '',
    '• Уведомления о занятиях приходят автоматически.',
    '• За 3 часа до индивидуального урока можно подтвердить или отменить участие.',
    '• Баланс уроков — кнопка «Баланс» или команда /balance.',
    '• Настройки уведомлений — кнопка «Уведомления» в главном меню.',
    '',
    'Если Telegram отвязался — привяжите снова в профиле личного кабинета.',
  ].join('\n'),
  balanceNotStudent:
    'Баланс доступен только для учеников.\nЕсли вы ученик — обратитесь к администратору.',
} as const;

export function formatLessonTime(startTime: string | null | undefined): string {
  const raw = String(startTime ?? '').trim();
  if (!raw) return '—';
  const [hours, minutes] = raw.split(':');
  if (!hours || !minutes) return raw;
  return `${hours.padStart(2, '0')}:${minutes.padStart(2, '0')}`;
}

export function resolveCourseTitle(input: {
  groupName?: string | null;
  lessonType?: string | null;
}): string {
  const groupName = (input.groupName ?? '').trim();
  if (groupName) return groupName;
  if ((input.lessonType ?? '').trim() === 'individual') {
    return 'Индивидуальное занятие';
  }
  return 'Китайский язык';
}

export function build24hReminderMessage(input: {
  time: string;
  course: string;
  teacher: string;
}): string {
  return [
    '📚 Напоминание об уроке',
    '',
    `Завтра в ${input.time}`,
    `Курс: ${input.course}`,
    `Преподаватель: ${input.teacher}`,
  ].join('\n');
}

export function build15mOnlineLessonReminderMessage(input: {
  time: string;
  teacher: string;
}): string {
  return [
    '🎥 Онлайн-урок',
    '',
    'Ваш онлайн-урок начнётся через 15 минут',
    `Время: ${input.time}`,
    `Преподаватель: ${input.teacher}`,
  ].join('\n');
}

export function buildOnlineLessonJoinKeyboard(joinUrl: string): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [[{ text: 'Войти в урок', url: joinUrl }]],
  };
}

export function build3hConfirmationMessage(input: {
  teacher: string;
  date: string;
  time: string;
}): string {
  return [
    'У вас индивидуальное занятие через 3 часа:',
    '',
    `Преподаватель: ${input.teacher}`,
    `Дата: ${input.date}`,
    `Время: ${input.time}`,
  ].join('\n');
}

export function buildTeacherLessonConfirmedMessage(input: {
  student: string;
  date: string;
  time: string;
}): string {
  return [
    'Ученик подтвердил индивидуальное занятие:',
    '',
    `Ученик: ${input.student}`,
    `Дата: ${input.date}`,
    `Время: ${input.time}`,
  ].join('\n');
}

export function buildTeacherLessonCancelledMessage(input: {
  student: string;
  date: string;
  time: string;
}): string {
  return [
    'Ученик отменил индивидуальное занятие:',
    '',
    `Ученик: ${input.student}`,
    `Дата: ${input.date}`,
    `Время: ${input.time}`,
  ].join('\n');
}

/**
 * Nearest-lesson card for Telegram «Мои занятия».
 * Students see the teacher; teachers see the student(s) — never their own name.
 */
export function buildNearestLessonCard(input: {
  course: string;
  whenLabel: string;
  audience: 'student' | 'teacher';
  /** Teacher name for students; student name(s) for teachers. */
  counterpartName: string;
  room?: string | null;
}): string {
  const counterpart = (input.counterpartName || '').trim() || '—';
  const course = (input.course || '').trim() || '—';
  const room = (input.room ?? '').trim();

  if (input.audience === 'teacher') {
    const lines = [
      '📚 Ближайшее занятие',
      '',
      `⏰ ${input.whenLabel}`,
      '',
      '👨‍🎓 Ученик:',
      counterpart,
      '',
      '📖 Курс:',
      course,
    ];
    if (room) {
      lines.push('', '🏫 Кабинет:', room);
    }
    return lines.join('\n');
  }

  return [
    `📚 ${course}`,
    `⏰ ${input.whenLabel}`,
    `👨‍🏫 Преподаватель: ${counterpart}`,
  ].join('\n');
}

export function buildConnectionStatusText(input: {
  connected: boolean;
  username: string | null;
  connectedAt: string | null;
}): string {
  if (!input.connected) {
    return ['👤 Профиль', '', '⚠️ Telegram не подключён'].join('\n');
  }
  const lines = ['👤 Профиль', '', '✅ Telegram подключён'];
  if (input.username) {
    lines.push(`Аккаунт: @${input.username}`);
  }
  if (input.connectedAt) {
    lines.push(`Дата: ${input.connectedAt}`);
  }
  return lines.join('\n');
}

/**
 * Student lesson balance copy (CRM stores remaining lessons in students.lesson_balance).
 */
export function buildBalanceText(input: {
  lessonBalance: number;
  updatedAtLabel: string | null;
}): string {
  const balance = Number.isFinite(input.lessonBalance)
    ? Math.trunc(input.lessonBalance)
    : 0;
  const amountLabel = formatLessonBalanceAmount(balance);

  if (balance < 0) {
    return [
      '⚠️ Ваш баланс:',
      '',
      amountLabel,
      '',
      'Для продолжения занятий необходимо пополнить баланс.',
    ].join('\n');
  }

  if (balance === 0) {
    return ['Ваш баланс:', '', amountLabel].join('\n');
  }

  const lines = ['💰 Ваш текущий баланс', '', 'Баланс:', amountLabel];
  if (input.updatedAtLabel) {
    lines.push('', 'Последнее обновление:', input.updatedAtLabel);
  }
  return lines.join('\n');
}

/** Russian plural for lesson counts, e.g. "5 уроков", "−1 урок". */
export function formatLessonBalanceAmount(balance: number): string {
  const abs = Math.abs(balance);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  let word = 'уроков';
  if (mod10 === 1 && mod100 !== 11) {
    word = 'урок';
  } else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    word = 'урока';
  }
  const sign = balance < 0 ? '−' : '';
  return `${sign}${abs} ${word}`;
}

export function buildNotificationSettingsText(input: {
  notify24h: boolean;
  notify3h: boolean;
}): string {
  return [
    '🔔 Уведомления',
    '',
    `Напоминание за 24 часа: ${input.notify24h ? 'вкл' : 'выкл'}`,
    `Подтверждение за 3 часа: ${input.notify3h ? 'вкл' : 'выкл'}`,
  ].join('\n');
}

/** Clears sticky bottom ReplyKeyboard (cannot be combined with inline_keyboard). */
export function replyKeyboardRemove(): {
  remove_keyboard: true;
} {
  return { remove_keyboard: true };
}

export function mainMenuInlineKeyboard(): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [
      [{ text: TELEGRAM_BTN.lessons, callback_data: TELEGRAM_CB.lessons }],
      [{ text: TELEGRAM_BTN.balance, callback_data: TELEGRAM_CB.balance }],
      [{ text: TELEGRAM_BTN.settings, callback_data: TELEGRAM_CB.settings }],
      [{ text: TELEGRAM_BTN.profile, callback_data: TELEGRAM_CB.profile }],
      [{ text: TELEGRAM_BTN.help, callback_data: TELEGRAM_CB.help }],
    ],
  };
}

export function backInlineKeyboard(): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [[{ text: TELEGRAM_BTN.back, callback_data: TELEGRAM_CB.main }]],
  };
}

export function settingsInlineKeyboard(input: {
  notify24h: boolean;
  notify3h: boolean;
}): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [
      [
        {
          text: input.notify24h ? '🔔 Напоминание: вкл' : '🔔 Напоминание: выкл',
          callback_data: TELEGRAM_CB.toggle24h,
        },
      ],
      [
        {
          text: input.notify3h ? '⏰ Подтверждение: вкл' : '⏰ Подтверждение: выкл',
          callback_data: TELEGRAM_CB.toggle3h,
        },
      ],
      [{ text: TELEGRAM_BTN.back, callback_data: TELEGRAM_CB.main }],
    ],
  };
}

export function confirmationInlineKeyboard(confirmationId: string): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [
      [
        {
          text: '✅ Подтвердить',
          callback_data: `lesson_confirm:${confirmationId}`,
        },
        {
          text: '❌ Отменить',
          callback_data: `lesson_decline:${confirmationId}`,
        },
      ],
    ],
  };
}

export function resultBackToMenuKeyboard(): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [
      [{ text: TELEGRAM_BTN.backToMenu, callback_data: TELEGRAM_CB.main }],
    ],
  };
}

export function matchMainMenuButton(
  text: string,
): 'lessons' | 'balance' | 'settings' | 'profile' | 'help' | null {
  const trimmed = text.trim();
  if (
    trimmed === TELEGRAM_BTN.lessons
    || trimmed === TELEGRAM_BTN.lessonsLegacy
  ) {
    return 'lessons';
  }
  if (
    trimmed === TELEGRAM_BTN.balance
    || trimmed === TELEGRAM_BTN.balanceLegacy
    || trimmed === '/balance'
    || trimmed.startsWith('/balance@')
  ) {
    return 'balance';
  }
  if (
    trimmed === TELEGRAM_BTN.settings
    || trimmed === TELEGRAM_BTN.settingsLegacy
  ) {
    return 'settings';
  }
  if (
    trimmed === TELEGRAM_BTN.profile
    || trimmed === TELEGRAM_BTN.statusLegacy
  ) {
    return 'profile';
  }
  if (trimmed === TELEGRAM_BTN.help) return 'help';
  return null;
}

/** Calendar date helpers for school wall-clock (REMINDER_TIMEZONE). */
export function getSchoolCalendarDateYmd(
  timeZone: string,
  now: Date = new Date(),
): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const y = parts.find((p) => p.type === 'year')?.value ?? '1970';
  const m = parts.find((p) => p.type === 'month')?.value ?? '01';
  const d = parts.find((p) => p.type === 'day')?.value ?? '01';
  return `${y}-${m}-${d}`;
}

export function addCalendarDaysYmd(dateYmd: string, days: number): string {
  const [y, m, d] = String(dateYmd)
    .split('-')
    .map((part) => Number(part));
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const next = new Date(utc);
  const yy = next.getUTCFullYear();
  const mm = String(next.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(next.getUTCDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export function getSchoolTomorrowDateYmd(
  timeZone: string,
  now: Date = new Date(),
): string {
  return addCalendarDaysYmd(getSchoolCalendarDateYmd(timeZone, now), 1);
}

/** e.g. «Пятница, 8 августа» */
export function formatSchoolDateLongRu(
  dateYmd: string,
  timeZone = 'Europe/Minsk',
): string {
  const [y, m, d] = String(dateYmd)
    .split('-')
    .map((part) => Number(part));
  if (!y || !m || !d) return dateYmd;
  const probe = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  const label = new Intl.DateTimeFormat('ru-RU', {
    timeZone,
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(probe);
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export type TomorrowDigestLessonLine = {
  startTime: string;
  participantLabel: string;
  lessonFormat?: 'online' | 'offline' | string | null;
};

export function buildTeacherTomorrowDigestMessage(input: {
  scheduleDateYmd: string;
  lessons: TomorrowDigestLessonLine[];
  timeZone?: string;
}): string {
  const tz = input.timeZone ?? 'Europe/Minsk';
  const dateLabel = formatSchoolDateLongRu(input.scheduleDateYmd, tz);
  const lines = input.lessons.map((lesson) => {
    const time = formatLessonTime(lesson.startTime);
    const format = String(lesson.lessonFormat ?? '').toLowerCase();
    const icon =
      format === 'offline' ? '🏫 ' : format === 'online' ? '💻 ' : '';
    const name = String(lesson.participantLabel ?? '').trim() || 'Занятие';
    return `${icon}${time} — ${name}`;
  });

  return [
    '📅 Ваше расписание на завтра',
    '',
    dateLabel,
    '',
    ...lines,
    '',
    `Всего уроков: ${input.lessons.length}`,
    '',
    'Желаем хороших занятий! 🐉',
  ].join('\n');
}
