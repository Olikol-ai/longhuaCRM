import { Module } from '@nestjs/common';
import { LessonsModule } from '../lessons/lessons.module';
import { TelegramModule } from '../telegram/telegram.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [LessonsModule, TelegramModule],
  controllers: [JobsController],
  providers: [JobsService],
  exports: [JobsService],
})
export class JobsModule {}
