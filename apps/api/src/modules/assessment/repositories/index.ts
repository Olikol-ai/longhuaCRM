import { AssessmentAssignmentRepository } from './assessment-assignment.repository';
import { AssessmentAttemptRepository } from './assessment-attempt.repository';
import { AssessmentBankRepository } from './assessment-bank.repository';
import { AssessmentExamBlockRepository } from './assessment-exam-block.repository';
import { AssessmentExamRepository } from './assessment-exam.repository';
import { AssessmentQuestionRepository } from './assessment-question.repository';
import { AssessmentResultRepository } from './assessment-result.repository';

/** All Assessment repository wrappers for module registration. */
export const ASSESSMENT_REPOSITORIES = [
  AssessmentBankRepository,
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
  AssessmentBankRepository,
  AssessmentExamBlockRepository,
  AssessmentExamRepository,
  AssessmentQuestionRepository,
  AssessmentResultRepository,
};
