import { Module } from '@nestjs/common';
import { EntitiesModule } from '../entities/entities.module';
import { SettingsModule } from '../settings/settings.module';
import { TelegramModule } from '../telegram/telegram.module';
import { AlfaBankService } from './alfabank.service';

@Module({
  imports: [EntitiesModule, SettingsModule, TelegramModule],
  providers: [AlfaBankService],
  exports: [AlfaBankService],
})
export class AlfaBankModule {}
