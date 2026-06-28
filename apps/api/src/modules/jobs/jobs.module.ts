import { Module } from '@nestjs/common';
import { RolesGuard } from '../../common/guards/roles.guard';
import { EntitiesModule } from '../entities/entities.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { TelegramModule } from '../telegram/telegram.module';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';

@Module({
  imports: [EntitiesModule, ScheduleModule, TelegramModule],
  controllers: [JobsController],
  providers: [JobsService, RolesGuard],
  exports: [JobsService],
})
export class JobsModule {}
