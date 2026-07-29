import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module';
import { AssessmentQuestionEntity } from '../assessment/entities/assessment-question.entity';
import { AssessmentAnswerEntity } from '../assessment/entities/assessment-answer.entity';
import { AssessmentQuestionAttachmentEntity } from '../assessment/entities/assessment-question-attachment.entity';
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
 * Reuses AssessmentScoringService and assessment_questions; owns homework_* tables.
 * Not linked to AssessmentExamEntity.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...HOMEWORK_ENTITIES,
      AssessmentQuestionEntity,
      AssessmentAnswerEntity,
      AssessmentQuestionAttachmentEntity,
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
