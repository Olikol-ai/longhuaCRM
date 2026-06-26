import { Module } from '@nestjs/common';
import { SettingsModule } from '../settings/settings.module';
import { TelegramService } from './telegram.service';
import { TelegramWebhookLifecycleService } from './telegram-webhook.lifecycle';

@Module({
  imports: [SettingsModule],
  providers: [TelegramService, TelegramWebhookLifecycleService],
  exports: [TelegramService],
})
export class TelegramModule {}
