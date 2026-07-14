import {
  Body,
  Controller,
  ForbiddenException,
  Headers,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SkipThrottle } from '@nestjs/throttler';
import { TelegramService } from './telegram.service';

@SkipThrottle()
@Controller('telegram')
export class TelegramController {
  private readonly logger = new Logger(TelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post('webhook')
  async webhook(
    @Body() body: Record<string, unknown>,
    @Headers('x-telegram-bot-api-secret-token') secretToken?: string,
  ) {
    const expectedSecret = this.config.get<string>('telegram.webhookSecret');
    const isProduction = this.config.get<string>('nodeEnv') === 'production';

    if (isProduction && !expectedSecret) {
      throw new ForbiddenException('TELEGRAM_WEBHOOK_SECRET is required in production');
    }

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
}
