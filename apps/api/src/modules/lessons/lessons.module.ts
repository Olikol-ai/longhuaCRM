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
import { LessonStudentChangeHistoryEntity } from './entities/lesson-student-change-history.entity';
import { StudentBalanceService } from '../students/student-balance.service';
import { LessonRescheduledNotifier } from './lesson-rescheduled.notifier';
import { LessonUpdatedNotifier } from './lesson-updated.notifier';
import { LessonsController } from './lessons.controller';
import { LessonsRepository } from './lessons.repository';
import { LessonsScheduler } from './lessons.scheduler';
import { LessonsService } from './lessons.service';
import { VideoModule } from '../video/video.module';
import { TeacherStudentContactsModule } from '../teacher-student-contacts/teacher-student-contacts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonEntity,
      AttendanceEntity,
      LessonStudentChangeHistoryEntity,
      StudentEntity,
      UserEntity,
    ]),
    ScheduleModule,
    TeacherPaymentsModule,
    CoursesModule,
    LessonConfirmationsModule,
    NotificationsModule,
    TelegramModule,
    VideoModule,
    TeacherStudentContactsModule,
  ],
  controllers: [LessonsController],
  providers: [
    LessonsRepository,
    LessonsService,
    LessonsScheduler,
    StudentBalanceService,
    LessonRescheduledNotifier,
    LessonUpdatedNotifier,
  ],
  exports: [LessonsRepository, LessonsService, LessonsScheduler, TypeOrmModule],
})
export class LessonsModule {}
