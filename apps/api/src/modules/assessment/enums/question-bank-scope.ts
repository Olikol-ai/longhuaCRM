/** Logical partition of assessment_questions (shared engine, separate banks). */
export const QuestionBankScope = {
  Assessment: 'assessment',
  ExamContent: 'exam_content',
} as const;

export type QuestionBankScope =
  (typeof QuestionBankScope)[keyof typeof QuestionBankScope];
