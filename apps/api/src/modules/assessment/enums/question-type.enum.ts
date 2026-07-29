/**
 * LongHua Assessment — question type vocabulary.
 * Extended types are reserved for future authoring/scoring; scoring falls back to manual where needed.
 */
export enum QuestionType {
  SingleChoice = 'single_choice',
  MultipleChoice = 'multiple_choice',
  ShortText = 'short_text',
  Listening = 'listening',
  Reading = 'reading',
  Translation = 'translation',
  Cloze = 'cloze',
  Matching = 'matching',
}

/** Types allowed in the Test bank and nested Reading/Listening questions. */
export const AUTHORING_ATOMIC_QUESTION_TYPES: ReadonlySet<QuestionType> = new Set([
  QuestionType.SingleChoice,
  QuestionType.MultipleChoice,
  QuestionType.ShortText,
  QuestionType.Translation,
]);

/** Legacy bank types — archived; use ReadingTask / ListeningTask instead. */
export const LEGACY_BANK_CONTENT_TYPES: ReadonlySet<QuestionType> = new Set([
  QuestionType.Reading,
  QuestionType.Listening,
]);
