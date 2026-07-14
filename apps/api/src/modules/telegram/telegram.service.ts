import { Injectable, Logger } from '@nestjs/common';
import { TelegramDiagnosticsService } from './telegram-diagnostics.service';
import { TelegramGateway, TelegramSendMessageOptions } from './telegram.gateway';
import { TelegramUpdateHandler } from './telegram-update.handler';

/**
 * Facade for Bot API ops + shared update pipeline (polling/webhook).
 */
@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

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

  async registerWebhook(webhookUrl: string, secretToken?: string) {
    const botToken = await this.getBotToken();
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

    this.logger.log(`Registering Telegram webhook: ${webhookUrl}`);

    const deleteResult = await this.gateway.deleteWebhook(true);
    this.logger.log(`deleteWebhook result: ${JSON.stringify(deleteResult)}`);

    const setResult = await this.gateway.setWebhook(
      webhookUrl,
      secretToken,
      ['message', 'callback_query'],
    );
    this.logger.log(`setWebhook result: ${JSON.stringify(setResult)}`);

    await this.clearBotCommands();
    const webhook = await this.gateway.getWebhookInfo();
    return { delete: deleteResult, set: setResult, webhook, target_url: webhookUrl };
  }

  async deleteWebhook() {
    const botToken = await this.getBotToken();
    if (!botToken) {
      this.logger.warn('Cannot delete webhook: TELEGRAM_BOT_TOKEN not set');
      return null;
    }
    this.logger.log('Deleting Telegram webhook');
    const result = await this.gateway.deleteWebhook(false);
    this.logger.log(`deleteWebhook on shutdown: ${JSON.stringify(result)}`);
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
}
