import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramWebhookIntake } from './telegram-webhook.intake';

/**
 * Canonical Telegram webhook endpoint.
 * URL: POST /api/telegram/webhook
 *
 * Telegram requires a timely 2xx; we force HTTP 200 (Nest defaults POST → 201).
 */
@SkipThrottle()
@Controller('telegram')
export class TelegramController {
  constructor(private readonly intake: TelegramWebhookIntake) {}

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    return this.intake.handle(body, secretToken, 'telegram.controller');
  }
}
