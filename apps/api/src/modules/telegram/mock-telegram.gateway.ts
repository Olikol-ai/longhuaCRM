import { Injectable, Logger } from '@nestjs/common';
import {
  TelegramApiResult,
  TelegramGateway,
  TelegramSendMessageOptions,
} from './telegram.gateway';

export type MockTelegramMessage = {
  chatId: string;
  text: string;
  options?: TelegramSendMessageOptions;
  at: string;
};

@Injectable()
export class MockTelegramGateway extends TelegramGateway {
  private readonly logger = new Logger(MockTelegramGateway.name);
  readonly sentMessages: MockTelegramMessage[] = [];
  readonly answeredCallbacks: Array<{ id: string; text?: string }> = [];
  private updateQueue: Record<string, unknown>[] = [];

  async getBotToken(): Promise<string | null> {
    return 'mock-token';
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResult> {
    const entry = {
      chatId: String(chatId),
      text,
      options,
      at: new Date().toISOString(),
    };
    this.sentMessages.push(entry);
    this.logger.log(`[mock] sendMessage → ${chatId}: ${text.slice(0, 80)}`);
    return { ok: true, result: { message_id: this.sentMessages.length } };
  }

  async editMessageText(
    chatId: string | number,
    messageId: number,
    text: string,
    options?: TelegramSendMessageOptions,
  ): Promise<TelegramApiResult> {
    const entry = {
      chatId: String(chatId),
      text,
      options,
      at: new Date().toISOString(),
    };
    this.sentMessages.push(entry);
    this.logger.log(
      `[mock] editMessageText → ${chatId}#${messageId}: ${text.slice(0, 80)}`,
    );
    return { ok: true, result: { message_id: messageId } };
  }

  async deleteMessage(
    chatId: string | number,
    messageId: number,
  ): Promise<TelegramApiResult> {
    this.logger.log(`[mock] deleteMessage → ${chatId}#${messageId}`);
    return { ok: true, result: true };
  }

  async answerCallbackQuery(
    callbackQueryId: string,
    text?: string,
  ): Promise<TelegramApiResult> {
    this.answeredCallbacks.push({ id: callbackQueryId, text });
    return { ok: true };
  }

  async getUpdates(
    _offset?: number,
    _timeoutSeconds?: number,
    signal?: AbortSignal,
  ): Promise<TelegramApiResult> {
    if (signal?.aborted) {
      return { ok: false, error: 'aborted' };
    }
    const batch = this.updateQueue.splice(0, this.updateQueue.length);
    return { ok: true, result: batch };
  }

  enqueueUpdate(update: Record<string, unknown>): void {
    this.updateQueue.push(update);
  }

  clear(): void {
    this.sentMessages.length = 0;
    this.answeredCallbacks.length = 0;
    this.updateQueue.length = 0;
  }

  async getMe(): Promise<TelegramApiResult> {
    return { ok: true, result: { username: 'mock_bot', id: 1 } };
  }

  async getWebhookInfo(): Promise<TelegramApiResult> {
    return { ok: true, result: { url: '' } };
  }

  async setWebhook(url: string): Promise<TelegramApiResult> {
    this.logger.log(`[mock] setWebhook ${url}`);
    return { ok: true, result: true, description: 'Webhook was set' };
  }

  async deleteWebhook(): Promise<TelegramApiResult> {
    return { ok: true, result: true };
  }

  async deleteMyCommands(): Promise<TelegramApiResult> {
    return { ok: true, result: true };
  }
}
