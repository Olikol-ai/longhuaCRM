import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';
import {
  TelegramApiResult,
  TelegramGateway,
  TelegramSendMessageOptions,
} from './telegram.gateway';

@Injectable()
export class HttpTelegramGateway extends TelegramGateway {
  private readonly logger = new Logger(HttpTelegramGateway.name);

  constructor(private readonly settingsService: SettingsService) {
    super();
  }

  async getBotToken(): Promise<string | null> {
    return this.settingsService.getTelegramBotToken();
  }

  private async call(
    method: string,
    body?: Record<string, unknown>,
    signal?: AbortSignal,
  ): Promise<TelegramApiResult> {
    const botToken = await this.getBotToken();
    if (!botToken) {
      return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
    }

    try {
      const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        signal,
      });
      return (await res.json()) as TelegramApiResult;
    } catch (error) {
      if (signal?.aborted) {
        return { ok: false, error: 'aborted' };
      }
      this.logger.error(`Telegram ${method} failed: ${(error as Error).message}`);
      return { ok: false, error: (error as Error).message };
    }
  }

  sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      text,
    };
    if (options?.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }
    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }
    return this.call('sendMessage', payload);
  }

  editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      chat_id: chatId,
      message_id: messageId,
      text,
    };
    if (options?.replyMarkup) {
      payload.reply_markup = options.replyMarkup;
    }
    if (options?.parseMode) {
      payload.parse_mode = options.parseMode;
    }
    return this.call('editMessageText', payload);
  }

  deleteMessage(
    chatId: string | number,
    messageId: number,
  ): Promise<TelegramApiResult> {
    return this.call('deleteMessage', {
      chat_id: chatId,
      message_id: messageId,
    });
  }

  answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      callback_query_id: callbackQueryId,
    };
    if (text) {
      payload.text = text;
    }
    return this.call('answerCallbackQuery', payload);
  }

  getUpdates(
    offset?: number,
    timeoutSeconds = 25,
    signal?: AbortSignal,
  ): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      timeout: timeoutSeconds,
      allowed_updates: ['message', 'callback_query'],
    };
    if (offset !== undefined) {
      payload.offset = offset;
    }
    return this.call('getUpdates', payload, signal);
  }

  getMe(): Promise<TelegramApiResult> {
    return this.call('getMe', {});
  }

  getWebhookInfo(): Promise<TelegramApiResult> {
    return this.call('getWebhookInfo', {});
  }

  setWebhook(
    url: string,
    secretToken?: string,
    allowedUpdates: string[] = ['message', 'callback_query'],
  ): Promise<TelegramApiResult> {
    const payload: Record<string, unknown> = {
      url,
      allowed_updates: allowedUpdates,
    };
    if (secretToken) {
      payload.secret_token = secretToken;
    }
    return this.call('setWebhook', payload);
  }

  deleteWebhook(dropPendingUpdates = false): Promise<TelegramApiResult> {
    return this.call('deleteWebhook', {
      drop_pending_updates: dropPendingUpdates,
    });
  }

  deleteMyCommands(): Promise<TelegramApiResult> {
    return this.call('deleteMyCommands', {});
  }
}
