import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  OnApplicationBootstrap,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { JobGuard } from '../../common/concurrency/job-guard';
import { assertHttpsTelegramWebhookUrl } from './telegram-mode.util';
import { TelegramService } from './telegram.service';

@Injectable()
export class TelegramWebhookLifecycleService
  implements OnApplicationBootstrap, BeforeApplicationShutdown
{
  private readonly logger = new Logger(TelegramWebhookLifecycleService.name);
  private readonly healthGuard = new JobGuard(this.logger, 'verifyWebhookHealth');

  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async onApplicationBootstrap() {
    if (!this.config.get<boolean>('telegram.enabled')) {
      this.logger.log('Telegram webhook registration skipped (TELEGRAM_ENABLED=false)');
      return;
    }

    if (this.config.get<boolean>('telegram.mock') === true) {
      this.logger.log('Telegram webhook registration skipped (TELEGRAM_MOCK=true)');
      return;
    }

    const mode = this.config.get<string>('telegram.mode') ?? 'webhook';
    if (mode === 'polling') {
      // Polling clears any prior webhook once in TelegramPollingService before getUpdates.
      this.logger.log('Telegram webhook registration skipped (TELEGRAM_MODE=polling)');
      return;
    }

    await this.ensureWebhook();
  }

  async beforeApplicationShutdown() {
    // Intentionally leave Telegram webhook registered across restarts/deploys.
    // Clearing it here created a delivery blackout until the next bootstrap
    // (and raced with local reloads). Re-registration on startup is idempotent;
    // health cron repairs mismatches. Use TELEGRAM_MODE=polling (or admin delete)
    // when the webhook must be removed.
    if ((this.config.get<string>('telegram.mode') ?? 'webhook') === 'webhook') {
      this.logger.log(
        'Graceful shutdown: leaving Telegram webhook registered for continuity',
      );
    }
  }

  @Cron('*/5 * * * *')
  async verifyWebhookHealth() {
    if (!this.config.get<boolean>('telegram.enabled')) return;
    if (!this.config.get<boolean>('jobs.enabled')) return;
    if (this.config.get<boolean>('telegram.mock') === true) return;
    if ((this.config.get<string>('telegram.mode') ?? 'webhook') === 'polling') {
      return;
    }

    await this.healthGuard.run(async () => {
      let expectedUrl: string;
      try {
        expectedUrl = this.resolveWebhookUrl();
      } catch (error) {
        this.logger.error((error as Error).message);
        return;
      }

      try {
        const info = await this.telegramService.getWebhookInfo();
        const currentUrl = (info as { result?: { url?: string; last_error_date?: number } })
          ?.result?.url;
        const lastErrorDate = (info as { result?: { last_error_date?: number } })?.result
          ?.last_error_date;

        if (currentUrl !== expectedUrl || lastErrorDate) {
          this.logger.warn(
            `Webhook mismatch or error detected (url=${currentUrl}, last_error_date=${lastErrorDate}). Re-registering...`,
          );
          await this.ensureWebhook();
        }
      } catch (error) {
        this.logger.error(`Webhook health check failed: ${(error as Error).message}`);
      }
    });
  }

  private async ensureWebhook() {
    let webhookUrl: string;
    try {
      webhookUrl = this.resolveWebhookUrl();
    } catch (error) {
      this.logger.error((error as Error).message);
      return;
    }

    try {
      const secret = this.config.get<string>('telegram.webhookSecret');
      const result = await this.telegramService.registerWebhook(
        webhookUrl,
        secret || undefined,
      );
      if (result.set?.ok) {
        this.logger.log('Telegram webhook registered successfully');
      } else {
        this.logger.error(
          `Telegram webhook registration failed: ${result.set?.description ?? 'Telegram setWebhook returned ok=false'}`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to register Telegram webhook: ${(error as Error).message}`);
    }
  }

  /**
   * Webhook mode uses only TELEGRAM_WEBHOOK_URL (no APP_PUBLIC_URL fallback).
   */
  private resolveWebhookUrl(): string {
    return assertHttpsTelegramWebhookUrl(this.config.get<string>('telegram.webhookUrl'));
  }
}
