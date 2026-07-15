import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/**
 * Logs Telegram integration status once at startup so misconfig
 * (especially TELEGRAM_MOCK string "false" bugs) is obvious in logs.
 */
@Injectable()
export class TelegramStartupLogger implements OnApplicationBootstrap {
  private readonly logger = new Logger('Telegram');

  constructor(private readonly config: ConfigService) {}

  onApplicationBootstrap() {
    const enabled = this.config.get<boolean>('telegram.enabled') === true;
    const mode = this.config.get<string>('telegram.mode') ?? 'webhook';
    const mock = this.config.get<boolean>('telegram.mock') === true;
    const botToken = (this.config.get<string>('telegram.botToken') ?? '').trim();
    const webhookUrl = (this.config.get<string>('telegram.webhookUrl') ?? '').trim();
    const secretConfigured = Boolean(
      (this.config.get<string>('telegram.webhookSecret') ?? '').trim(),
    );

    this.logger.log(`Telegram enabled: ${enabled ? 'YES' : 'NO'}`);
    this.logger.log(`Mode: ${mode}`);
    this.logger.log(`Mock: ${mock ? 'YES' : 'NO'}`);
    this.logger.log(`Bot token configured: ${botToken ? 'YES' : 'NO'}`);
    if (mode === 'webhook') {
      this.logger.log(`Webhook URL: ${webhookUrl || '(missing TELEGRAM_WEBHOOK_URL)'}`);
      this.logger.log(`Webhook secret configured: ${secretConfigured ? 'YES' : 'NO'}`);
      this.logger.log('Polling lifecycle: OFF (webhook mode)');
    } else {
      this.logger.log('Webhook registration: OFF (polling mode)');
      this.logger.log('Polling lifecycle: ON when token is present');
    }
  }
}
