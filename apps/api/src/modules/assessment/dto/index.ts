export { PaginationQueryDto, paginateArray } from './common/pagination-query.dto';

export { CreateBankDto } from './banks/create-bank.dto';
export { UpdateBankDto } from './banks/update-bank.dto';
export { ListBanksQueryDto } from './banks/list-banks-query.dto';

export { CreateQuestionDto, CreateAnswerDto } from './questions/create-question.dto';
export { UpdateQuestionDto } from './questions/update-question.dto';
export { ListQuestionsQueryDto } from './questions/list-questions-query.dto';
export { CreateAttachmentDto } from './questions/create-attachment.dto';

export { CreateExamDto, ExamRuleDto } from './exams/create-exam.dto';
export { UpdateExamDto } from './exams/update-exam.dto';
export { ListExamsQueryDto } from './exams/list-exams-query.dto';

export {
  CreateExamBlockDto,
  UpdateExamBlockDto,
  ListExamBlocksQueryDto,
} from './blocks/exam-block.dto';

export { CreateAssignmentDto } from './assignments/create-assignment.dto';
export { ListAssignmentsQueryDto } from './assignments/list-assignments-query.dto';

export { StartAttemptDto } from './attempts/start-attempt.dto';
export { SubmitAttemptDto, SubmitAnswerDto } from './attempts/submit-attempt.dto';
export {
  AutosaveAnswersDto,
  AutosaveAnswerItemDto,
} from './attempts/autosave-answers.dto';
export { ListAttemptsQueryDto } from './attempts/list-attempts-query.dto';

export { DownloadAttachmentQueryDto } from './attachments/download-attachment-query.dto';

export { ListResultsQueryDto } from './results/list-results-query.dto';
export {
  SaveReviewDto,
  ReviewAnswerItemDto,
} from './results/save-review.dto';
