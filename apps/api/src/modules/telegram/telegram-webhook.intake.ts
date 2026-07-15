import {
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TelegramService } from './telegram.service';

/**
 * Shared Telegram webhook intake used by the dedicated controller
 * and the legacy compatibility route. One processing path only.
 */
@Injectable()
export class TelegramWebhookIntake {
  private readonly logger = new Logger(TelegramWebhookIntake.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  async handle(
    body: Record<string, unknown>,
    secretToken: string | undefined,
    source: 'telegram.controller' | 'webhooks.legacy',
  ): Promise<{ ok: true }> {
    const expectedSecret = this.config.get<string>('telegram.webhookSecret');
    const isProduction = this.config.get<string>('nodeEnv') === 'production';

    if (isProduction && !expectedSecret) {
      throw new ForbiddenException('TELEGRAM_WEBHOOK_SECRET is required in production');
    }

    if (expectedSecret && secretToken !== expectedSecret) {
      this.logger.warn(`Rejected Telegram webhook (${source}): invalid secret`);
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    if (source === 'webhooks.legacy') {
      this.logger.warn(
        'Legacy endpoint POST /api/webhooks/telegram was used. '
        + 'Prefer POST /api/telegram/webhook (TELEGRAM_WEBHOOK_URL).',
      );
    }

    const updateId = Number(body.update_id ?? 0) || null;
    const kind = body.callback_query
      ? 'callback_query'
      : body.message
        ? 'message'
        : 'other';
    this.logger.log(
      `Incoming Telegram update source=${source} update_id=${updateId ?? 'n/a'} kind=${kind}`,
    );

    try {
      await this.telegramService.handleUpdate(body);
      return { ok: true };
    } catch (error) {
      this.logger.error(
        `Telegram webhook error source=${source} update_id=${updateId ?? 'n/a'}: ${(error as Error).message}`,
      );
      // Always 200 to Telegram so it does not retry aggressively on handler bugs.
      return { ok: true };
    }
  }
}
