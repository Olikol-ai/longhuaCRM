export type TelegramInlineButton = {
  text: string;
  callback_data: string;
};

export type TelegramReplyMarkup =
  | {
      inline_keyboard: TelegramInlineButton[][];
    }
  | {
      keyboard: Array<Array<{ text: string }>>;
      resize_keyboard?: boolean;
      one_time_keyboard?: boolean;
    };

export type TelegramSendMessageOptions = {
  replyMarkup?: TelegramReplyMarkup;
  parseMode?: 'HTML' | 'Markdown' | 'MarkdownV2';
};

export type TelegramApiResult = {
  ok: boolean;
  error?: string;
  description?: string;
  result?: unknown;
  [key: string]: unknown;
};

export type TelegramUpdate = Record<string, unknown>;

/**
 * Transport port for Telegram Bot API (HTTP).
 * Real and mock implementations share this contract.
 */
export abstract class TelegramGateway {
  abstract getBotToken(): Promise<string | null>;

  abstract sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResult>;

  abstract editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResult>;

  abstract answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<TelegramApiResult>;

  abstract getUpdates(
    offset?: number,
    timeoutSeconds?: number,
    signal?: AbortSignal,
  ): Promise<TelegramApiResult>;

  abstract getMe(): Promise<TelegramApiResult>;

  abstract getWebhookInfo(): Promise<TelegramApiResult>;

  abstract setWebhook(
    url: string,
    secretToken?: string,
    allowedUpdates?: string[],
  ): Promise<TelegramApiResult>;

  abstract deleteWebhook(dropPendingUpdates?: boolean): Promise<TelegramApiResult>;

  /** Clear bot command menu — CRM bot is notifications-only. */
  abstract deleteMyCommands(): Promise<TelegramApiResult>;
}

export const TELEGRAM_GATEWAY = Symbol('TELEGRAM_GATEWAY');
