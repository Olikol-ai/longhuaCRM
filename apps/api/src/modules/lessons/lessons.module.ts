import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CoursesModule } from '../courses/courses.module';
import { LessonConfirmationsModule } from '../lesson-confirmations/lesson-confirmations.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ScheduleModule } from '../schedule/schedule.module';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherPaymentsModule } from '../teacher-payments/teacher-payments.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UserEntity } from '../users/entities/user.entity';
import { AttendanceEntity } from './entities/attendance.entity';
import { LessonEntity } from './entities/lesson.entity';
import { StudentBalanceService } from '../students/student-balance.service';
import { LessonRescheduledNotifier } from './lesson-rescheduled.notifier';
import { LessonUpdatedNotifier } from './lesson-updated.notifier';
import { LessonsController } from './lessons.controller';
import { LessonsRepository } from './lessons.repository';
import { LessonsService } from './lessons.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonEntity,
      AttendanceEntity,
      StudentEntity,
      UserEntity,
    ]),
    ScheduleModule,
    TeacherPaymentsModule,
    CoursesModule,
    LessonConfirmationsModule,
    NotificationsModule,
    TelegramModule,
  ],
  controllers: [LessonsController],
  providers: [
    LessonsRepository,
    LessonsService,
    StudentBalanceService,
    LessonRescheduledNotifier,
    LessonUpdatedNotifier,
  ],
  exports: [LessonsRepository, LessonsService, TypeOrmModule],
})
export class LessonsModule {}
