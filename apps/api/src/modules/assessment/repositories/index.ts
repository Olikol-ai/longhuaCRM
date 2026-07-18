import { AssessmentAssignmentRepository } from './assessment-assignment.repository';
import { AssessmentAttemptRepository } from './assessment-attempt.repository';
import { AssessmentBankRepository } from './assessment-bank.repository';
import { AssessmentBlueprintRepository } from './assessment-blueprint.repository';
import { AssessmentExamRepository } from './assessment-exam.repository';
import { AssessmentExamTemplateRepository } from './assessment-exam-template.repository';
import { AssessmentQuestionRepository } from './assessment-question.repository';
import { AssessmentResultRepository } from './assessment-result.repository';

/** All Assessment repository wrappers for module registration. */
export const ASSESSMENT_REPOSITORIES = [
  AssessmentBankRepository,
  AssessmentQuestionRepository,
  AssessmentExamTemplateRepository,
  AssessmentBlueprintRepository,
  AssessmentExamRepository,
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentResultRepository,
] as const;

export {
  AssessmentAssignmentRepository,
  AssessmentAttemptRepository,
  AssessmentBankRepository,
  AssessmentBlueprintRepository,
  AssessmentExamRepository,
  AssessmentExamTemplateRepository,
  AssessmentQuestionRepository,
  AssessmentResultRepository,
};
