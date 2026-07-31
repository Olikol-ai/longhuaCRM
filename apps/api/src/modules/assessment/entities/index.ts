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
import { AssessmentExamPartEntity } from './assessment-exam-part.entity';
import { AssessmentExamPartPoolItemEntity } from './assessment-exam-part-pool-item.entity';
import { AssessmentReadingTaskEntity } from './assessment-reading-task.entity';
import { AssessmentReadingQuestionEntity } from './assessment-reading-question.entity';
import { AssessmentReadingQuestionAnswerEntity } from './assessment-reading-question-answer.entity';
import { AssessmentReadingTaskVocabularyEntity } from './assessment-reading-task-vocabulary.entity';
import { AssessmentListeningTaskEntity } from './assessment-listening-task.entity';
import { AssessmentListeningQuestionEntity } from './assessment-listening-question.entity';
import { AssessmentListeningQuestionAnswerEntity } from './assessment-listening-question-answer.entity';
import { AssessmentListeningTaskVocabularyEntity } from './assessment-listening-task-vocabulary.entity';
import { AssessmentQuestionSnapshotVocabularyEntity } from './assessment-question-snapshot-vocabulary.entity';

/** All Assessment TypeORM entities for module / registry registration. */
export const ASSESSMENT_ENTITIES = [
  AssessmentTopicEntity,
  AssessmentQuestionEntity,
  AssessmentQuestionTopicEntity,
  AssessmentAnswerEntity,
  AssessmentQuestionAttachmentEntity,
  AssessmentReadingTaskEntity,
  AssessmentReadingQuestionEntity,
  AssessmentReadingQuestionAnswerEntity,
  AssessmentReadingTaskVocabularyEntity,
  AssessmentListeningTaskEntity,
  AssessmentListeningQuestionEntity,
  AssessmentListeningQuestionAnswerEntity,
  AssessmentListeningTaskVocabularyEntity,
  AssessmentExamBlockEntity,
  AssessmentExamBlockItemEntity,
  AssessmentExamEntity,
  AssessmentExamPartEntity,
  AssessmentExamPartPoolItemEntity,
  AssessmentRuleEntity,
  AssessmentSectionEntity,
  AssessmentExamQuestionEntity,
  AssessmentExamAssignmentEntity,
  AssessmentAttemptEntity,
  AssessmentQuestionSnapshotEntity,
  AssessmentAnswerSnapshotEntity,
  AssessmentQuestionSnapshotVocabularyEntity,
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
  AssessmentReadingTaskEntity,
  AssessmentReadingQuestionEntity,
  AssessmentReadingQuestionAnswerEntity,
  AssessmentReadingTaskVocabularyEntity,
  AssessmentListeningTaskEntity,
  AssessmentListeningQuestionEntity,
  AssessmentListeningQuestionAnswerEntity,
  AssessmentListeningTaskVocabularyEntity,
  AssessmentExamBlockEntity,
  AssessmentExamBlockItemEntity,
  AssessmentExamEntity,
  AssessmentExamPartEntity,
  AssessmentExamPartPoolItemEntity,
  AssessmentRuleEntity,
  AssessmentSectionEntity,
  AssessmentExamQuestionEntity,
  AssessmentExamAssignmentEntity,
  AssessmentAttemptEntity,
  AssessmentQuestionSnapshotEntity,
  AssessmentAnswerSnapshotEntity,
  AssessmentQuestionSnapshotVocabularyEntity,
  AssessmentAttemptAnswerEntity,
  AssessmentAttemptAnswerSelectionEntity,
  AssessmentResultEntity,
  AssessmentResultBreakdownEntity,
  AssessmentChangeJournalEntity,
};
