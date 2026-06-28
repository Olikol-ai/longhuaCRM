import { Module, forwardRef } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramAdminController } from './telegram-admin.controller';
import { TelegramService } from './telegram.service';
import { TelegramWebhookLifecycleService } from './telegram-webhook.lifecycle';

@Module({
  imports: [SettingsModule, forwardRef(() => AuthModule)],
  controllers: [TelegramAdminController],
  providers: [TelegramService, TelegramWebhookLifecycleService, RolesGuard],
  exports: [TelegramService],
})
export class TelegramModule {}
