/**
 * Canonical user-facing Telegram copy + keyboards.
 * CRM database remains the only source of truth for user data.
 */

import type { TelegramInlineButton } from './telegram.gateway';

export const TELEGRAM_BTN = {
  lessons: '📚 Мои ближайшие уроки',
  settings: '🔔 Настройки уведомлений',
  status: '⚙️ Статус подключения',
  back: '← Назад',
} as const;

export const TELEGRAM_CB = {
  main: 'menu:main',
  lessons: 'menu:lessons',
  settings: 'menu:settings',
  status: 'menu:status',
  toggle24h: 'settings:toggle_24h',
  toggle3h: 'settings:toggle_3h',
} as const;

export const TELEGRAM_MSG = {
  startLinked: '✅ Longhua CRM подключён',
  startNotLinked:
    'Здравствуйте!\n\nTelegram ещё не подключён.\nОткройте профиль в личном кабинете и нажмите «Привязать Telegram».',
  linkFailed:
    'Ссылка больше не действует.\nСоздайте новую в профиле личного кабинета.',
  confirmed: 'Спасибо! Участие подтверждено.',
  declined: 'Урок отменён. Информация передана администратору.',
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
  time: string;
  course: string;
  teacher: string;
}): string {
  return [
    '⏰ Через 3 часа начинается урок',
    '',
    `Курс: ${input.course}`,
    `Время: ${input.time}`,
    `Преподаватель: ${input.teacher}`,
    '',
    'Подтвердите участие:',
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
    return ['⚙️ Статус подключения', '', '⚠️ Не подключён'].join('\n');
  }
  const lines = ['⚙️ Статус подключения', '', '✅ Подключён'];
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
    '🔔 Настройки уведомлений',
    '',
    `Напоминание за 24 часа: ${input.notify24h ? 'вкл' : 'выкл'}`,
    `Подтверждение за 3 часа: ${input.notify3h ? 'вкл' : 'выкл'}`,
  ].join('\n');
}

export function mainMenuInlineKeyboard(): {
  inline_keyboard: TelegramInlineButton[][];
} {
  return {
    inline_keyboard: [
      [{ text: TELEGRAM_BTN.lessons, callback_data: TELEGRAM_CB.lessons }],
      [{ text: TELEGRAM_BTN.settings, callback_data: TELEGRAM_CB.settings }],
      [{ text: TELEGRAM_BTN.status, callback_data: TELEGRAM_CB.status }],
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
          text: '✅ Подтверждаю',
          callback_data: `lesson_confirm:${confirmationId}`,
        },
        {
          text: '❌ Не смогу прийти',
          callback_data: `lesson_decline:${confirmationId}`,
        },
      ],
    ],
  };
}

export function matchMainMenuButton(
  text: string,
): 'lessons' | 'settings' | 'status' | null {
  const trimmed = text.trim();
  if (trimmed === TELEGRAM_BTN.lessons) return 'lessons';
  if (trimmed === TELEGRAM_BTN.settings) return 'settings';
  if (trimmed === TELEGRAM_BTN.status) return 'status';
  return null;
}
