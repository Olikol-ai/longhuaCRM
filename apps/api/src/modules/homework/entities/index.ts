import { HomeworkEntity } from './homework.entity';
import { HomeworkItemEntity } from './homework-item.entity';
import { HomeworkItemAnswerEntity } from './homework-item-answer.entity';
import { HomeworkAssignmentEntity } from './homework-assignment.entity';
import { HomeworkAttemptEntity } from './homework-attempt.entity';
import { HomeworkQuestionSnapshotEntity } from './homework-question-snapshot.entity';
import { HomeworkAnswerSnapshotEntity } from './homework-answer-snapshot.entity';
import { HomeworkAttemptAnswerEntity } from './homework-attempt-answer.entity';
import { HomeworkAttemptAnswerSelectionEntity } from './homework-attempt-answer-selection.entity';
import { HomeworkResultEntity } from './homework-result.entity';

export const HOMEWORK_ENTITIES = [
  HomeworkEntity,
  HomeworkItemEntity,
  HomeworkItemAnswerEntity,
  HomeworkAssignmentEntity,
  HomeworkAttemptEntity,
  HomeworkQuestionSnapshotEntity,
  HomeworkAnswerSnapshotEntity,
  HomeworkAttemptAnswerEntity,
  HomeworkAttemptAnswerSelectionEntity,
  HomeworkResultEntity,
] as const;

export {
  HomeworkEntity,
  HomeworkItemEntity,
  HomeworkItemAnswerEntity,
  HomeworkAssignmentEntity,
  HomeworkAttemptEntity,
  HomeworkQuestionSnapshotEntity,
  HomeworkAnswerSnapshotEntity,
  HomeworkAttemptAnswerEntity,
  HomeworkAttemptAnswerSelectionEntity,
  HomeworkResultEntity,
};
