import { Module } from '@nestjs/common';
import { EntitiesModule } from '../entities/entities.module';
import { TelegramModule } from '../telegram/telegram.module';
import { JobsService } from './jobs.service';

@Module({
  imports: [EntitiesModule, TelegramModule],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
