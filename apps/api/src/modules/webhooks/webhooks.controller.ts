import {
  Body,
  Controller,
  Header,
  Headers,
  Logger,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { AlfaBankService } from '../alfabank/alfabank.service';
import { TelegramService } from '../telegram/telegram.service';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly alfaBankService: AlfaBankService,
    private readonly config: ConfigService,
  ) {}

  @Post('telegram')
  async telegramWebhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    const expectedSecret = this.config.get<string>('telegram.webhookSecret');
    if (expectedSecret && secretToken !== expectedSecret) {
      throw new UnauthorizedException('Invalid Telegram webhook secret');
    }

    try {
      await this.telegramService.handleUpdate(body);
      return { ok: true };
    } catch (error) {
      this.logger.error(`Telegram webhook error: ${(error as Error).message}`);
      return { ok: true };
    }
  }

  @Post('alfabank')
  @Header('Content-Type', 'text/plain; charset=utf-8')
  async alfaBankWebhook(@Req() req: Request) {
    try {
      const bodyText =
        typeof req.body === 'string'
          ? req.body
          : new URLSearchParams(req.body as Record<string, string>).toString();
      const result = await this.alfaBankService.handleWebhook(bodyText);
      return result;
    } catch (error) {
      this.logger.error(`AlfaBank webhook error: ${(error as Error).message}`);
      return '0';
    }
  }
}
