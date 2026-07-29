import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentEntity } from '../students/entities/student.entity';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TelegramModule } from '../telegram/telegram.module';
import { TutorEntity } from '../tutors/entities/tutor.entity';
import { TutorStudentEntity } from '../tutors/entities/tutor-student.entity';
import { UserEntity } from '../users/entities/user.entity';
import { HomeworkController } from './controllers/homework.controller';
import { HOMEWORK_ENTITIES } from './entities';
import { HomeworkNotifierService } from './services/homework-notifier.service';
import { HomeworkService } from './services/homework.service';
import { DomainAccessModule } from '../../common/access/domain-access.module';

/**
 * Homework bounded context.
 * Owns homework_* tables with inline questions on homework_items.
 * Reuses AssessmentScoringService for attempt scoring.
 * Not linked to AssessmentExamEntity / ExamBlock.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...HOMEWORK_ENTITIES,
      StudentEntity,
      TeacherEntity,
      TutorEntity,
      TutorStudentEntity,
      UserEntity,
    ]),
    AssessmentModule,
    DomainAccessModule,
    NotificationsModule,
    TelegramModule,
  ],
  controllers: [HomeworkController],
  providers: [HomeworkService, HomeworkNotifierService],
  exports: [HomeworkService],
})
export class HomeworkModule {}
