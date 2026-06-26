import { Module } from '@nestjs/common';
import { AlfaBankModule } from '../alfabank/alfabank.module';
import { JobsModule } from '../jobs/jobs.module';
import { TelegramModule } from '../telegram/telegram.module';
import { FunctionsController } from './functions.controller';

@Module({
  imports: [TelegramModule, AlfaBankModule, JobsModule],
  controllers: [FunctionsController],
})
export class FunctionsModule {}
