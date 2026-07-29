import { AssessmentService } from './assessment.service';
import { AssessmentContentGuard } from './assessment-content.guard';
import { AssessmentParticipantResolver } from './assessment-participant-resolver.service';
import { AssessmentAttachmentService } from './assessment-attachment.service';
import { AssessmentScoringService } from './assessment-scoring.service';
import { AssessmentTimeoutJobService } from './assessment-timeout-job.service';
import { QuestionAuthoringService } from './question-authoring.service';
import { ExamBlockService } from './exam-block.service';
import { ExamService } from './exam.service';
import { AssignmentService } from './assignment.service';
import { AttemptService } from './attempt.service';
import { ResultService } from './result.service';
import { AssessmentAssignmentNotifier } from './assessment-assignment-notifier.service';
import { AssessmentReviewNotifier } from './assessment-review-notifier.service';
import { AssessmentChangeJournalService } from './assessment-change-journal.service';
import { ContentTaskService } from './content-task.service';

export const ASSESSMENT_SERVICES = [
  AssessmentContentGuard,
  AssessmentParticipantResolver,
  AssessmentAttachmentService,
  AssessmentScoringService,
  AssessmentTimeoutJobService,
  AssessmentChangeJournalService,
  AssessmentService,
  QuestionAuthoringService,
  ContentTaskService,
  ExamBlockService,
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
  AssessmentChangeJournalService,
  QuestionAuthoringService,
  ContentTaskService,
  ExamBlockService,
  ExamService,
  AssignmentService,
  AttemptService,
  ResultService,
  AssessmentAssignmentNotifier,
  AssessmentReviewNotifier,
};
