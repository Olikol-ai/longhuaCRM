import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module';
import {
  AssessmentExamPartEntity,
  AssessmentExamPartPoolItemEntity,
} from '../assessment/entities';
import { ExamContentItemEntity } from '../exam-content/entities';
import { ExamContentModule } from '../exam-content/exam-content.module';
import { TeacherEntity } from '../teachers/entities/teacher.entity';
import { ExamAcademyCatalogController } from './controllers/exam-academy-catalog.controller';
import { ExamAcademyMeController } from './controllers/exam-academy-me.controller';
import { ExamAcademySessionsController } from './controllers/exam-academy-sessions.controller';
import { EXAM_ACADEMY_ENTITIES } from './entities';
import { ExamAcademyCatalogSeedService } from './seed/exam-academy-catalog.seed';
import { ExamAcademyCatalogService } from './services/exam-academy-catalog.service';
import { ExamAcademySessionService } from './services/exam-academy-session.service';

/**
 * Universal international exam prep product layer (HSK Academy UI is the first skin).
 * Assessment remains the testing engine. Bank/templates live in Exam Content Platform.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      ...EXAM_ACADEMY_ENTITIES,
      ExamContentItemEntity,
      AssessmentExamPartEntity,
      AssessmentExamPartPoolItemEntity,
      TeacherEntity,
    ]),
    AssessmentModule,
    ExamContentModule,
  ],
  controllers: [
    ExamAcademyCatalogController,
    ExamAcademySessionsController,
    ExamAcademyMeController,
  ],
  providers: [
    ExamAcademyCatalogService,
    ExamAcademyCatalogSeedService,
    ExamAcademySessionService,
  ],
  exports: [
    ExamAcademyCatalogService,
    ExamAcademySessionService,
    TypeOrmModule,
  ],
})
export class ExamAcademyModule {}
