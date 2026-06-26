import { Injectable, Logger } from '@nestjs/common';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class TelegramService {
  private readonly logger = new Logger(TelegramService.name);

  constructor(private readonly settingsService: SettingsService) {}

  async getBotToken(): Promise<string | null> {
    return this.settingsService.getTelegramBotToken();
  }

  async sendMessage(chatId: string | number, text: string) {
    const botToken = await this.getBotToken();
    if (!botToken) {
      return { ok: false, error: 'TELEGRAM_BOT_TOKEN not set' };
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.json();
  }

  async getBotInfo() {
    const botToken = await this.getBotToken();
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

    const [botRes, webhookRes] = await Promise.all([
      fetch(`https://api.telegram.org/bot${botToken}/getMe`),
      fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`),
    ]);

    const bot = await botRes.json();
    const webhook = await webhookRes.json();
    return { bot, webhook, token_last5: botToken.slice(-5) };
  }

  async registerWebhook(webhookUrl: string, secretToken?: string) {
    const botToken = await this.getBotToken();
    if (!botToken) throw new Error('TELEGRAM_BOT_TOKEN not set');

    this.logger.log(`Registering Telegram webhook: ${webhookUrl}`);

    const deleteRes = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: true }),
    });
    const deleteResult = await deleteRes.json();
    this.logger.log(`deleteWebhook result: ${JSON.stringify(deleteResult)}`);

    const payload: Record<string, unknown> = {
      url: webhookUrl,
      allowed_updates: ['message'],
    };
    if (secretToken) payload.secret_token = secretToken;

    const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const setResult = await setRes.json();
    this.logger.log(`setWebhook result: ${JSON.stringify(setResult)}`);

    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    const webhook = await infoRes.json();

    return { delete: deleteResult, set: setResult, webhook, target_url: webhookUrl };
  }

  async deleteWebhook() {
    const botToken = await this.getBotToken();
    if (!botToken) {
      this.logger.warn('Cannot delete webhook: TELEGRAM_BOT_TOKEN not set');
      return null;
    }

    this.logger.log('Deleting Telegram webhook');
    const res = await fetch(`https://api.telegram.org/bot${botToken}/deleteWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ drop_pending_updates: false }),
    });
    const result = await res.json();
    this.logger.log(`deleteWebhook on shutdown: ${JSON.stringify(result)}`);
    return result;
  }

  async getWebhookInfo() {
    const botToken = await this.getBotToken();
    if (!botToken) return null;
    const res = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`);
    return res.json();
  }

  async handleUpdate(update: Record<string, unknown>) {
    const message = update.message as
      | { text?: string; chat?: { id?: number }; from?: { first_name?: string } }
      | undefined;
    if (!message?.text?.startsWith('/start') || !message.chat?.id) {
      return { ok: true };
    }

    const firstName = message.from?.first_name || 'Пользователь';
    const welcomeMsg = `🎉 Спасибо за подключение уведомлений!\n\nПривет, ${firstName}! Ваш Telegram успешно привязан к платформе Longhua Chinese 🐉\n\nТеперь вы будете получать уведомления:\n• ✅ О завершении уроков\n• ⏰ Напоминания перед занятиями\n• 💳 О пополнении баланса\n\nУдачи в изучении китайского языка! 加油！`;

    await this.sendMessage(message.chat.id, welcomeMsg);
    return { ok: true };
  }
}
