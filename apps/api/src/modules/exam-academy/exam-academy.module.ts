import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module';
import {
  AssessmentExamPartEntity,
  AssessmentExamPartPoolItemEntity,
} from '../assessment/entities';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { ExamAcademyCatalogController } from './controllers/exam-academy-catalog.controller';
import { ExamAcademyMeController } from './controllers/exam-academy-me.controller';
import { ExamAcademySessionsController } from './controllers/exam-academy-sessions.controller';
import { ExamAcademyBankController } from './controllers/exam-academy-bank.controller';
import { EXAM_ACADEMY_ENTITIES } from './entities';
import { ExamAcademyCatalogSeedService } from './seed/exam-academy-catalog.seed';
import { ExamAcademyCatalogService } from './services/exam-academy-catalog.service';
import { ExamAcademySessionService } from './services/exam-academy-session.service';
import { ExamAcademyBankService } from './services/exam-academy-bank.service';

/**
 * Universal international exam prep product layer (HSK Academy UI is the first skin).
 * Assessment remains the testing engine.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...EXAM_ACADEMY_ENTITIES,
      AssessmentExamPartEntity,
      AssessmentExamPartPoolItemEntity,
      TeacherEntity,
    ]),
    AssessmentModule,
  ],
  controllers: [
    ExamAcademyCatalogController,
    ExamAcademySessionsController,
    ExamAcademyMeController,
    ExamAcademyBankController,
  ],
  providers: [
    ExamAcademyCatalogService,
    ExamAcademyCatalogSeedService,
    ExamAcademySessionService,
    ExamAcademyBankService,
  ],
  exports: [
    ExamAcademyCatalogService,
    ExamAcademySessionService,
    ExamAcademyBankService,
    TypeOrmModule,
  ],
})
export class ExamAcademyModule {}
