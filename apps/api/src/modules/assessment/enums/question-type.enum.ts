/**
 * LongHua Assessment — question type vocabulary.
 */
export enum QuestionType {
  SingleChoice = 'single_choice',
  MultipleChoice = 'multiple_choice',
  /** Free-text answer — manual teacher review. */
  ShortText = 'short_text',
  Listening = 'listening',
  Reading = 'reading',
  /** Translation / long writing — manual teacher review. */
  Translation = 'translation',
  /** Oral answer (audio) — manual teacher review. */
  Speaking = 'speaking',
  Cloze = 'cloze',
  Matching = 'matching',
}

/** Types allowed in the Test bank and nested Reading/Listening questions. */
export const AUTHORING_ATOMIC_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([
  QuestionType.SingleChoice,
  QuestionType.MultipleChoice,
  QuestionType.ShortText,
  QuestionType.Translation,
  QuestionType.Speaking,
]);

/** Legacy bank types — archived; use ReadingTask / ListeningTask instead. */
export const LEGACY_BANK_CONTENT_TYPES: ReadonlySet<QuestionType> = new Set([
  QuestionType.Reading,
  QuestionType.Listening,
]);

/** Question types scored only by a teacher/tutor (never auto-graded). */
export const MANUAL_REVIEW_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([
  QuestionType.ShortText,
  QuestionType.Translation,
  QuestionType.Speaking,
]);

export function isManualReviewQuestionType(type: QuestionType | string): boolean {
  return MANUAL_REVIEW_QUESTION_TYPES.has(type as QuestionType);
}
