import {
  Body,
  Controller,
  ForbiddenException,
  Header,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  Req,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { AlfaBankService } from '../alfabank/alfabank.service';
import { TelegramWebhookIntake } from '../telegram/telegram-webhook.intake';

@SkipThrottle()
@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly telegramWebhookIntake: TelegramWebhookIntake,
    private readonly alfaBankService: AlfaBankService,
  ) {}

  /**
   * Legacy compatibility route. Canonical endpoint is POST /api/telegram/webhook.
   * Kept so older Cloudflare tunnel paths keep working while logging a deprecation warning.
   */
  @Post('telegram')
  @HttpCode(HttpStatus.OK)
  telegramWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    return this.telegramWebhookIntake.handle(body, secretToken, 'webhooks.legacy');
  }

  @Post('alfabank')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async alfaBankWebhook(@Req() req: Request) {
    try {
      const bodyText =
        typeof req.body === 'string'
          ? req.body
          : new URLSearchParams(req.body as Record<string, string>).toString();
      return await this.alfaBankService.handleWebhook(bodyText);
    } catch (error) {
      if (error instanceof ForbiddenException) {
        this.logger.warn(`AlfaBank webhook rejected: ${error.message}`);
        throw error;
      }
      this.logger.error(`AlfaBank webhook error: ${(error as Error).message}`);
      return '0';
    }
  }
}
