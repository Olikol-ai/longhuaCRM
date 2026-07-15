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
  settings: '🔔 Уведомления',
  profile: '👤 Профиль',
  help: '❓ Помощь',
  back: '← Назад',
  backToMenu: 'Вернуться в меню',
  /** Legacy reply-keyboard labels (still handled if a stale keyboard is tapped) */
  lessonsLegacy: '📚 Мои ближайшие уроки',
  settingsLegacy: '🔔 Настройки уведомлений',
  statusLegacy: '⚙️ Статус подключения',
} as const;

export const TELEGRAM_CB = {
  main: 'menu:main',
  lessons: 'menu:lessons',
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
    '✅ Longhua CRM подключён\n\nВыберите действие в меню ниже:',
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
    '• Настройки уведомлений — кнопка «Уведомления» в главном меню.',
    '',
    'Если Telegram отвязался — привяжите снова в профиле личного кабинета.',
  ].join('\n'),
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

export function buildNearestLessonCard(input: {
  course: string;
  whenLabel: string;
  teacher: string;
}): string {
  return [
    `📚 ${input.course}`,
    `⏰ ${input.whenLabel}`,
    `👨‍🏫 Преподаватель: ${input.teacher}`,
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
): 'lessons' | 'settings' | 'profile' | 'help' | null {
  const trimmed = text.trim();
  if (
    trimmed === TELEGRAM_BTN.lessons
    || trimmed === TELEGRAM_BTN.lessonsLegacy
  ) {
    return 'lessons';
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
