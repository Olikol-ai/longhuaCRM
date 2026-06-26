import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { TelegramService } from './telegram.service';

@Injectable()
export class TelegramWebhookLifecycleService implements OnApplicationBootstrap, BeforeApplicationShutdown {
  private readonly logger = new Logger(TelegramWebhookLifecycleService.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get<boolean>('telegram.enabled')) {
      this.logger.log('Telegram webhook registration skipped (TELEGRAM_ENABLED=false)');
      return;
    }
    await this.ensureWebhook();
  }

  async beforeApplicationShutdown() {
    if (!this.config.get<boolean>('telegram.enabled')) return;
    await this.telegramService.deleteWebhook();
  }

  @Cron('*/5 * * * *')
  async verifyWebhookHealth() {
    if (!this.config.get<boolean>('telegram.enabled')) return;
    if (!this.config.get<boolean>('jobs.enabled')) return;

    const expectedUrl = this.resolveWebhookUrl();
    if (!expectedUrl) return;

    try {
      const info = await this.telegramService.getWebhookInfo();
      const currentUrl = info?.result?.url;
      const lastErrorDate = info?.result?.last_error_date;

      if (currentUrl !== expectedUrl || lastErrorDate) {
        this.logger.warn(
          `Webhook mismatch or error detected (url=${currentUrl}, last_error_date=${lastErrorDate}). Re-registering...`,
        );
        await this.ensureWebhook();
      }
    } catch (error) {
      this.logger.error(`Webhook health check failed: ${(error as Error).message}`);
    }
  }

  private async ensureWebhook() {
    const webhookUrl = this.resolveWebhookUrl();
    if (!webhookUrl) {
      this.logger.warn('TELEGRAM_WEBHOOK_URL is not configured; webhook was not registered');
      return;
    }

    try {
      const secret = this.config.get<string>('telegram.webhookSecret');
      await this.telegramService.registerWebhook(webhookUrl, secret || undefined);
      this.logger.log('Telegram webhook registered successfully');
    } catch (error) {
      this.logger.error(`Failed to register Telegram webhook: ${(error as Error).message}`);
    }
  }

  private resolveWebhookUrl(): string | undefined {
    const configured = this.config.get<string>('telegram.webhookUrl');
    if (configured) return configured;

    const publicUrl = this.config.get<string>('appPublicUrl');
    if (publicUrl) return `${publicUrl.replace(/\/$/, '')}/api/webhooks/telegram`;

    return undefined;
  }
}
