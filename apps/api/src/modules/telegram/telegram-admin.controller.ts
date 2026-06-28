import { Controller, Post, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { Roles } from '../../common/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { TelegramService } from './telegram.service';

@Controller('telegram/admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
export class TelegramAdminController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('register-webhook')
  registerWebhook(@Req() req: Request) {
    const origin = `${req.protocol}://${req.get('host')}`;
    const webhookUrl = `${origin}/api/webhooks/telegram`;
    return this.telegramService.registerWebhook(webhookUrl);
  }

  @Post('fix-webhook')
  fixWebhook(@Req() req: Request) {
    return this.registerWebhook(req);
  }

  @Post('clear-updates')
  clearTelegramUpdates(@Req() req: Request) {
    return this.registerWebhook(req);
  }

  @Post('check-bot-info')
  checkBotInfo() {
    return this.telegramService.getBotInfo();
  }
}
