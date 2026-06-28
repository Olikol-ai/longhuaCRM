import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { LessonEntity } from '../../entities/Lesson.entity';
import { LessonSeriesEntity } from '../../entities/LessonSeries.entity';
import { LessonSeriesExclusionEntity } from '../../entities/LessonSeriesExclusion.entity';
import { LessonSeriesStudentEntity } from '../../entities/LessonSeriesStudent.entity';
import { LessonStudentEntity } from '../../entities/LessonStudent.entity';
import { StudentEntity } from '../../entities/Student.entity';
import { TeacherEntity } from '../../entities/Teacher.entity';
import { TeacherAvailabilityBookingEntity } from '../../entities/TeacherAvailabilityBooking.entity';
import { TeacherAvailabilitySlotEntity } from '../../entities/TeacherAvailabilitySlot.entity';
import { LessonSeriesService } from './lesson-series.service';
import { TeacherAvailabilityBookingService } from './teacher-availability-booking.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      TeacherAvailabilityBookingEntity,
      TeacherAvailabilitySlotEntity,
      LessonEntity,
      LessonStudentEntity,
      LessonSeriesEntity,
      LessonSeriesStudentEntity,
      LessonSeriesExclusionEntity,
      StudentEntity,
      TeacherEntity,
    ]),
  ],
  providers: [TeacherAvailabilityBookingService, LessonSeriesService],
  exports: [TeacherAvailabilityBookingService, LessonSeriesService],
})
export class ScheduleModule {}
