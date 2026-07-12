import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { AvailabilityBookingEntity } from './entities/availability-booking.entity';
import { AvailabilitySlotEntity } from './entities/availability-slot.entity';
import { ScheduleController } from './schedule.controller';
import { ScheduleRepository } from './schedule.repository';
import { ScheduleService } from './schedule.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      AvailabilitySlotEntity,
      AvailabilityBookingEntity,
      TeacherEntity,
      LessonEntity,
    ]),
  ],
  controllers: [ScheduleController],
  providers: [ScheduleRepository, ScheduleService],
  exports: [ScheduleRepository, ScheduleService, TypeOrmModule],
})
export class ScheduleModule {}
