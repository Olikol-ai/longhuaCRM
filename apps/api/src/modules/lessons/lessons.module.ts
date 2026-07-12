import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from '../courses/courses.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { TeacherPaymentsModule } from '../teacher-payments/teacher-payments.module';
import { AttendanceEntity } from './entities/attendance.entity';
import { LessonEntity } from './entities/lesson.entity';
import { StudentBalanceService } from '../students/student-balance.service';
import { LessonsController } from './lessons.controller';
import { LessonsRepository } from './lessons.repository';
import { LessonsService } from './lessons.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([LessonEntity, AttendanceEntity]),
    ScheduleModule,
    TeacherPaymentsModule,
    CoursesModule,
  ],
  controllers: [LessonsController],
  providers: [LessonsRepository, LessonsService, StudentBalanceService],
  exports: [LessonsRepository, LessonsService, TypeOrmModule],
})
export class LessonsModule {}
