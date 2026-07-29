import { AssessmentAssignmentRepository } from './assessment-assignment.repository';
import { AssessmentAttemptRepository } from './assessment-attempt.repository';
import { AssessmentExamBlockRepository } from './assessment-exam-block.repository';
import { AssessmentExamRepository } from './assessment-exam.repository';
import { AssessmentQuestionRepository } from './assessment-question.repository';
import { AssessmentResultRepository } from './assessment-result.repository';

/** All Assessment repository wrappers for module registration. */
export const ASSESSMENT_REPOSITORIES = [
  AssessmentQuestionRepository,
  AssessmentExamBlockRepository,
  AssessmentExamRepository,
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentResultRepository,
] as const;

export {
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentExamBlockRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
  AssessmentResultRepository,
};
