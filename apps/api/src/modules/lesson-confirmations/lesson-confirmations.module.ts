import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { AttendanceEntity } from '../lessons/entities/attendance.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { UserEntity } from '../users/entities/user.entity';
import { TelegramGatewayModule } from '../telegram/telegram-gateway.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LessonConfirmationEntity } from './entities/lesson-confirmation.entity';
import { LessonConfirmationJobsService } from './lesson-confirmation-jobs.service';
import { LessonConfirmationService } from './lesson-confirmation.service';
import { GroupEntity } from '../groups/entities/group.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      LessonConfirmationEntity,
      LessonEntity,
      AttendanceEntity,
      AvailabilityBookingEntity,
      StudentEntity,
      TeacherEntity,
      GroupEntity,
      GroupMemberEntity,
      UserEntity,
    ]),
    TelegramGatewayModule,
    NotificationsModule,
  ],
  providers: [LessonConfirmationService, LessonConfirmationJobsService],
  exports: [LessonConfirmationService, LessonConfirmationJobsService, TypeOrmModule],
})
export class LessonConfirmationsModule {}
