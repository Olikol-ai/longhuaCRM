import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { LessonSeriesEntity } from '../lesson-series/entities/lesson-series.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { AvailabilitySlotEntity } from '../schedule/entities/availability-slot.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherPaymentEntity } from '../teacher-payments/entities/teacher-payment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherDeletionService } from './teacher-deletion.service';
import { TeachersController } from './teachers.controller';
import { TeachersRepository } from './teachers.repository';
import { TeachersService } from './teachers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherEntity,
      UserEntity,
      LessonEntity,
      GroupEntity,
      LessonSeriesEntity,
      TeacherPaymentEntity,
      StudentEntity,
      AvailabilitySlotEntity,
      AvailabilityBookingEntity,
    ]),
  ],
  controllers: [TeachersController],
  providers: [TeachersRepository, TeachersService, TeacherDeletionService],
  exports: [TeachersRepository, TeachersService, TeacherDeletionService, TypeOrmModule],
})
export class TeachersModule {}
