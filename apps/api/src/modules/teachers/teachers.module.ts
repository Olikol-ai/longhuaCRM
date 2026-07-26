import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { GroupEntity } from '../groups/entities/group.entity';
import { LessonSeriesEntity } from '../lesson-series/entities/lesson-series.entity';
import { LessonEntity } from '../lessons/entities/lesson.entity';
import { AvailabilityBookingEntity } from '../schedule/entities/availability-booking.entity';
import { AvailabilitySlotEntity } from '../schedule/entities/availability-slot.entity';
import { ScheduleModule } from '../schedule/schedule.module';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherPaymentEntity } from '../teacher-payments/entities/teacher-payment.entity';
import { UserEntity } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { TeacherEntity } from './entities/teacher.entity';
import { TeacherInviteLinkEntity } from './entities/teacher-invite-link.entity';
import { TeacherDeletionService } from './teacher-deletion.service';
import { TeacherInvitesController } from './teacher-invites.controller';
import { TeacherInvitesService } from './teacher-invites.service';
import { TeachersController } from './teachers.controller';
import { TeachersRepository } from './teachers.repository';
import { TeachersService } from './teachers.service';

@Module({
  imports: [
    ScheduleModule,
    forwardRef(() => UsersModule),
    TypeOrmModule.forFeature([
      TeacherEntity,
      TeacherInviteLinkEntity,
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
  controllers: [TeachersController, TeacherInvitesController],
  providers: [
    TeachersRepository,
    TeachersService,
    TeacherDeletionService,
    TeacherInvitesService,
  ],
  exports: [
    TeachersRepository,
    TeachersService,
    TeacherDeletionService,
    TeacherInvitesService,
    TypeOrmModule,
  ],
})
export class TeachersModule {}
