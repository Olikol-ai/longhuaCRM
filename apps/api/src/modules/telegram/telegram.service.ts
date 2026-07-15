import { Injectable, Logger } from '@nestjs/common';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramGateway, TelegramSendMessageOptions } from './telegram.gateway';
import { TelegramUpdateHandler } from './telegram-update.handler';

/** Bounded set of recently processed update_id values (webhook dedupe). */
const RECENT_UPDATE_MAX = 2_000;

/**
 * Facade for Bot API ops + shared update pipeline (polling/webhook).
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);
  private readonly recentUpdateIds = new Map<number, true>();

  constructor(
    private readonly gateway: TelegramGateway,
    private readonly updateHandler: TelegramUpdateHandler,
    private readonly diagnostics: TelegramDiagnosticsService,
  ) {}

  async getBotToken(): Promise<string | null> {
    return this.gateway.getBotToken();
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    options?: TelegramSendMessageOptions,
  ) {
    this.diagnostics.recordOutbound(chatId, text);
    return this.gateway.sendMessage(chatId, text, options);
  }

  async handleUpdate(update: Record<string, unknown>) {
    const updateId = Number(update.update_id ?? 0);
    if (Number.isFinite(updateId) && updateId > 0) {
      if (this.recentUpdateIds.has(updateId)) {
        this.logger.debug(`Skipping duplicate Telegram update_id=${updateId}`);
        return { ok: true, duplicate: true };
      }
      this.rememberUpdateId(updateId);
    }
    return this.updateHandler.handleUpdate(update);
  }

  async getBotInfo() {
    const botToken = await this.getBotToken();
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

    const [bot, webhook] = await Promise.all([
      this.gateway.getMe(),
      this.gateway.getWebhookInfo(),
    ]);

    return { bot, webhook, token_last5: botToken.slice(-5) };
  }

  /**
   * Idempotent webhook registration:
   * - if Telegram already has the same URL → refresh setWebhook without drop_pending
   * - if URL differs → drop pending updates, then setWebhook
   */
  async registerWebhook(webhookUrl: string, secretToken?: string) {
    const botToken = await this.getBotToken();
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

    const current = await this.gateway.getWebhookInfo();
    const currentUrl =
      (current.result as { url?: string } | undefined)?.url?.trim() || '';

    let deleteResult: unknown = null;
    if (currentUrl && currentUrl !== webhookUrl) {
      this.logger.log(
        `Replacing Telegram webhook ${currentUrl} → ${webhookUrl} (drop pending updates)`,
      );
      deleteResult = await this.gateway.deleteWebhook(true);
      this.logger.log(`deleteWebhook result: ${JSON.stringify(deleteResult)}`);
    } else if (currentUrl === webhookUrl) {
      this.logger.log(
        `Telegram webhook already registered at ${webhookUrl} — refreshing setWebhook (idempotent)`,
      );
    } else {
      this.logger.log(`Registering Telegram webhook: ${webhookUrl}`);
    }

    const setResult = await this.gateway.setWebhook(
      webhookUrl,
      secretToken,
      ['message', 'callback_query'],
    );
    this.logger.log(`setWebhook result: ${JSON.stringify(setResult)}`);

    await this.clearBotCommands();
    const webhook = await this.gateway.getWebhookInfo();
    return {
      delete: deleteResult,
      set: setResult,
      webhook,
      target_url: webhookUrl,
      skipped_delete: !deleteResult,
    };
  }

  async deleteWebhook() {
    const botToken = await this.getBotToken();
    if (!botToken) {
      this.logger.warn('Cannot delete webhook: TELEGRAM_BOT_TOKEN not set');
      return null;
    }
    this.logger.log('Deleting Telegram webhook');
    const result = await this.gateway.deleteWebhook(false);
    this.logger.log(`deleteWebhook result: ${JSON.stringify(result)}`);
    return result;
  }

  /** Hide leftover bot menus — bot is notifications + confirmations only. */
  async clearBotCommands() {
    const botToken = await this.getBotToken();
    if (!botToken) return null;
    const result = await this.gateway.deleteMyCommands();
    this.logger.log(`deleteMyCommands: ${JSON.stringify(result)}`);
    return result;
  }

  async getWebhookInfo() {
    const botToken = await this.getBotToken();
    if (!botToken) return null;
    return this.gateway.getWebhookInfo();
  }

  private rememberUpdateId(updateId: number): void {
    this.recentUpdateIds.delete(updateId);
    this.recentUpdateIds.set(updateId, true);
    while (this.recentUpdateIds.size > RECENT_UPDATE_MAX) {
      const oldest = this.recentUpdateIds.keys().next().value;
      if (oldest === undefined) {
        break;
      }
      this.recentUpdateIds.delete(oldest);
    }
  }
}
