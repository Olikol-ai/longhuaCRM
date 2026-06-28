import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TelegramService } from './telegram.service';

@Controller('telegram/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TelegramAdminController {
  constructor(
    private readonly telegramService: TelegramService,
    private readonly config: ConfigService,
  ) {}

  @Post('register-webhook')
  registerWebhook(@Req() req: Request) {
    return this.registerWithSecret(req);
  }

  @Post('fix-webhook')
  fixWebhook(@Req() req: Request) {
    return this.registerWithSecret(req);
  }

  @Post('clear-updates')
  clearTelegramUpdates(@Req() req: Request) {
    return this.registerWithSecret(req);
  }

  @Post('check-bot-info')
  checkBotInfo() {
    return this.telegramService.getBotInfo();
  }

  private registerWithSecret(req: Request) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${origin}/api/webhooks/telegram`;
    const secret = this.config.get<string>('telegram.webhookSecret') || undefined;
    return this.telegramService.registerWebhook(webhookUrl, secret);
  }
}
