import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SecureFilesModule } from '../files/secure-files.module';
import { EnrollmentEntity } from '../courses/entities/enrollment.entity';
import { GroupMemberEntity } from '../groups/entities/group-member.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { StudentEntity } from '../students/entities/student.entity';
import { StudentsModule } from '../students/students.module';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { TeachersModule } from '../teachers/teachers.module';
import { TelegramModule } from '../telegram/telegram.module';
import { UserEntity } from '../users/entities/user.entity';
import { AssessmentAssignmentsController } from './controllers/assessment-assignments.controller';
import { AssessmentAttemptsController } from './controllers/assessment-attempts.controller';
import { AssessmentAttachmentsController } from './controllers/assessment-attachments.controller';
import { AssessmentBanksController } from './controllers/assessment-banks.controller';
import { AssessmentExamBlocksController } from './controllers/assessment-exam-blocks.controller';
import { AssessmentExamsController } from './controllers/assessment-exams.controller';
import { AssessmentQuestionsController } from './controllers/assessment-questions.controller';
import { AssessmentResultsController } from './controllers/assessment-results.controller';
import { AssessmentController } from './controllers/assessment.controller';
import { ASSESSMENT_ENTITIES } from './entities';
import { ASSESSMENT_REPOSITORIES } from './repositories';
import { ASSESSMENT_SERVICES } from './services';

/**
 * LongHua Assessment bounded context.
 *
 * Owns exam/attempt/result domain tables (`assessment_*`).
 * Hierarchy: Question → ExamBlock → Exam.
 * Access rules live in AssessmentAccessService (DomainAccessModule).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...ASSESSMENT_ENTITIES,
      StudentEntity,
      TeacherEntity,
      UserEntity,
      GroupMemberEntity,
      EnrollmentEntity,
    ]),
    StudentsModule,
    TeachersModule,
    SecureFilesModule,
    NotificationsModule,
    TelegramModule,
  ],
  controllers: [
    AssessmentController,
    AssessmentBanksController,
    AssessmentQuestionsController,
    AssessmentExamBlocksController,
    AssessmentExamsController,
    AssessmentAssignmentsController,
    AssessmentAttemptsController,
    AssessmentAttachmentsController,
    AssessmentResultsController,
  ],
  providers: [...ASSESSMENT_REPOSITORIES, ...ASSESSMENT_SERVICES],
  exports: [...ASSESSMENT_SERVICES, ...ASSESSMENT_REPOSITORIES, TypeOrmModule],
})
export class AssessmentModule {}
