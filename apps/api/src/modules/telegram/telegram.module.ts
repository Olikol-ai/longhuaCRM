import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SettingsModule } from '../settings/settings.module';
import { TelegramAdminController } from './telegram-admin.controller';
import { TelegramService } from './telegram.service';
import { TelegramWebhookLifecycleService } from './telegram-webhook.lifecycle';

@Module({
  imports: [SettingsModule],
  controllers: [TelegramAdminController],
  providers: [TelegramService, TelegramWebhookLifecycleService, RolesGuard],
  exports: [TelegramService],
})
export class TelegramModule {}
