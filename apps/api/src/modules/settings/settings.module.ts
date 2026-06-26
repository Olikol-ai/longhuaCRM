import { Module } from '@nestjs/common';
import { EntitiesModule } from '../entities/entities.module';
import { SettingsService } from './settings.service';

@Module({
  imports: [EntitiesModule],
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
