import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AssessmentModule } from '../assessment/assessment.module';
import { ExamContentController } from './controllers/exam-content.controller';
import { EXAM_CONTENT_ENTITIES } from './entities';
import { ExamContentAccessService } from './services/exam-content-access.service';
import { ExamContentChangeLogService } from './services/exam-content-change-log.service';
import { ExamContentTaxonomyService } from './services/exam-content-taxonomy.service';
import { ExamContentMediaService } from './services/exam-content-media.service';
import { ExamContentItemsService } from './services/exam-content-items.service';
import { ExamContentGroupsService } from './services/exam-content-groups.service';
import { ExamContentBlueprintsService } from './services/exam-content-blueprints.service';
import { ExamContentVariantGeneratorService } from './services/exam-content-variant-generator.service';
import { ExamContentOpsService } from './services/exam-content-ops.service';

/**
 * Exam Content Platform — universal content CMS for international exams.
 * Assessment remains the testing engine; Academy is the learner product shell.
 */
@Module({
  imports: [TypeOrmModule.forFeature([...EXAM_CONTENT_ENTITIES]), AssessmentModule],
  controllers: [ExamContentController],
  providers: [
    ExamContentAccessService,
    ExamContentChangeLogService,
    ExamContentTaxonomyService,
    ExamContentMediaService,
    ExamContentItemsService,
    ExamContentGroupsService,
    ExamContentBlueprintsService,
    ExamContentVariantGeneratorService,
    ExamContentOpsService,
  ],
  exports: [
    ExamContentVariantGeneratorService,
    ExamContentItemsService,
    ExamContentBlueprintsService,
    ExamContentTaxonomyService,
    TypeOrmModule,
  ],
})
export class ExamContentModule {}
