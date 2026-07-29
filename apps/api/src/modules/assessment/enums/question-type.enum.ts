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
