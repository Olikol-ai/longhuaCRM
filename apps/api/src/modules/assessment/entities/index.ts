import { AssessmentTopicEntity } from './assessment-topic.entity';
import { AssessmentQuestionEntity } from './assessment-question.entity';
import { AssessmentQuestionTopicEntity } from './assessment-question-topic.entity';
import { AssessmentAnswerEntity } from './assessment-answer.entity';
import { AssessmentQuestionAttachmentEntity } from './assessment-question-attachment.entity';
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentRuleEntity } from './assessment-rule.entity';
import { AssessmentSectionEntity } from './assessment-section.entity';
import { AssessmentExamQuestionEntity } from './assessment-exam-question.entity';
import { AssessmentExamAssignmentEntity } from './assessment-exam-assignment.entity';
import { AssessmentAttemptEntity } from './assessment-attempt.entity';
import { AssessmentQuestionSnapshotEntity } from './assessment-question-snapshot.entity';
import { AssessmentAnswerSnapshotEntity } from './assessment-answer-snapshot.entity';
import { AssessmentAttemptAnswerEntity } from './assessment-attempt-answer.entity';
import { AssessmentAttemptAnswerSelectionEntity } from './assessment-attempt-answer-selection.entity';
import { AssessmentResultEntity } from './assessment-result.entity';
import { AssessmentResultBreakdownEntity } from './assessment-result-breakdown.entity';
import { AssessmentExamBlockEntity } from './assessment-exam-block.entity';
import { AssessmentExamBlockItemEntity } from './assessment-exam-block-item.entity';
import { AssessmentChangeJournalEntity } from './assessment-change-journal.entity';

/** All Assessment TypeORM entities for module / registry registration. */
export const ASSESSMENT_ENTITIES = [
  AssessmentTopicEntity,
  AssessmentQuestionEntity,
  AssessmentQuestionTopicEntity,
  AssessmentAnswerEntity,
  AssessmentQuestionAttachmentEntity,
  AssessmentExamBlockEntity,
  AssessmentExamBlockItemEntity,
  AssessmentExamEntity,
  AssessmentRuleEntity,
  AssessmentSectionEntity,
  AssessmentExamQuestionEntity,
  AssessmentExamAssignmentEntity,
  AssessmentAttemptEntity,
  AssessmentQuestionSnapshotEntity,
  AssessmentAnswerSnapshotEntity,
  AssessmentAttemptAnswerEntity,
  AssessmentAttemptAnswerSelectionEntity,
  AssessmentResultEntity,
  AssessmentResultBreakdownEntity,
  AssessmentChangeJournalEntity,
] as const;

export {
  AssessmentTopicEntity,
  AssessmentQuestionEntity,
  AssessmentQuestionTopicEntity,
  AssessmentAnswerEntity,
  AssessmentQuestionAttachmentEntity,
  AssessmentExamBlockEntity,
  AssessmentExamBlockItemEntity,
  AssessmentExamEntity,
  AssessmentRuleEntity,
  AssessmentSectionEntity,
  AssessmentExamQuestionEntity,
  AssessmentExamAssignmentEntity,
  AssessmentAttemptEntity,
  AssessmentQuestionSnapshotEntity,
  AssessmentAnswerSnapshotEntity,
  AssessmentAttemptAnswerEntity,
  AssessmentAttemptAnswerSelectionEntity,
  AssessmentResultEntity,
  AssessmentResultBreakdownEntity,
  AssessmentChangeJournalEntity,
};
