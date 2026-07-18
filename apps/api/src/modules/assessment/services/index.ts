import { AssessmentService } from './assessment.service';
import { AssessmentContentGuard } from './assessment-content.guard';
import { AssessmentParticipantResolver } from './assessment-participant-resolver.service';
import { AssessmentAttachmentService } from './assessment-attachment.service';
import { AssessmentScoringService } from './assessment-scoring.service';
import { AssessmentTimeoutJobService } from './assessment-timeout-job.service';
import { AssessmentBankService } from './assessment-bank.service';
import { QuestionAuthoringService } from './question-authoring.service';
import { ExamTemplateService } from './exam-template.service';
import { BlueprintService } from './blueprint.service';
import { ExamService } from './exam.service';
import { AssignmentService } from './assignment.service';
import { AttemptService } from './attempt.service';
import { ResultService } from './result.service';
import { AssessmentAssignmentNotifier } from './assessment-assignment-notifier.service';
import { AssessmentReviewNotifier } from './assessment-review-notifier.service';

export const ASSESSMENT_SERVICES = [
  AssessmentContentGuard,
  AssessmentParticipantResolver,
  AssessmentAttachmentService,
  AssessmentScoringService,
  AssessmentTimeoutJobService,
  AssessmentService,
  AssessmentBankService,
  QuestionAuthoringService,
  ExamTemplateService,
  BlueprintService,
  ExamService,
  AssignmentService,
  AttemptService,
  ResultService,
  AssessmentAssignmentNotifier,
  AssessmentReviewNotifier,
] as const;

export {
  AssessmentService,
  AssessmentContentGuard,
  AssessmentParticipantResolver,
  AssessmentAttachmentService,
  AssessmentScoringService,
  AssessmentTimeoutJobService,
  AssessmentBankService,
  QuestionAuthoringService,
  ExamTemplateService,
  BlueprintService,
  ExamService,
  AssignmentService,
  AttemptService,
  ResultService,
  AssessmentAssignmentNotifier,
  AssessmentReviewNotifier,
};
