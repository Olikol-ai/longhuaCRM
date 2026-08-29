import { HomeworkEntity } from './homework.entity';
import { HomeworkItemEntity } from './homework-item.entity';
import { HomeworkItemAnswerEntity } from './homework-item-answer.entity';
import { HomeworkAssignmentEntity } from './homework-assignment.entity';
import { HomeworkAttemptEntity } from './homework-attempt.entity';
import { HomeworkQuestionSnapshotEntity } from './homework-question-snapshot.entity';
import { HomeworkAnswerSnapshotEntity } from './homework-answer-snapshot.entity';
import { HomeworkQuestionSnapshotVocabularyEntity } from './homework-question-snapshot-vocabulary.entity';
import { HomeworkAttemptAnswerEntity } from './homework-attempt-answer.entity';
import { HomeworkAttemptAnswerSelectionEntity } from './homework-attempt-answer-selection.entity';
import { HomeworkResultEntity } from './homework-result.entity';
import { HomeworkTaskEntity } from './homework-task.entity';
import { HomeworkAccessEntity } from './homework-access.entity';

export const HOMEWORK_ENTITIES = [
  HomeworkEntity,
  HomeworkItemEntity,
  HomeworkItemAnswerEntity,
  HomeworkTaskEntity,
  HomeworkAssignmentEntity,
  HomeworkAttemptEntity,
  HomeworkQuestionSnapshotEntity,
  HomeworkAnswerSnapshotEntity,
  HomeworkQuestionSnapshotVocabularyEntity,
  HomeworkAttemptAnswerEntity,
  HomeworkAttemptAnswerSelectionEntity,
  HomeworkResultEntity,
  HomeworkAccessEntity,
] as const;

export {
  HomeworkEntity,
  HomeworkItemEntity,
  HomeworkItemAnswerEntity,
  HomeworkTaskEntity,
  HomeworkAssignmentEntity,
  HomeworkAttemptEntity,
  HomeworkQuestionSnapshotEntity,
  HomeworkAnswerSnapshotEntity,
  HomeworkQuestionSnapshotVocabularyEntity,
  HomeworkAttemptAnswerEntity,
  HomeworkAttemptAnswerSelectionEntity,
  HomeworkResultEntity,
  HomeworkAccessEntity,
};
