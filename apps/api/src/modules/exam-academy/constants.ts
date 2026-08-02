/**
 * Exam Academy string vocabularies.
 * Item types are registered in DB (`exam_academy_item_types`), not in a closed enum.
 */
export const CONTENT_STATUS = {
  Draft: 'draft',
  Published: 'published',
  Archived: 'archived',
} as const;

export const CATALOG_STATUS = {
  Active: 'active',
  Archived: 'archived',
} as const;

export const SESSION_MODE = {
  Practice: 'practice',
  MockExam: 'mock_exam',
  RandomExam: 'random_exam',
  ErrorReview: 'error_review',
  Favorites: 'favorites',
} as const;

export const SESSION_STATUS = {
  Draft: 'draft',
  Ready: 'ready',
  InProgress: 'in_progress',
  Completed: 'completed',
  /** Attempt timer elapsed (with engagement); shown as «Просрочен». */
  Expired: 'expired',
  Cancelled: 'cancelled',
} as const;

/** Statuses visible in «Моя подготовка» history (only with engagement). */
export const PREPARATION_HISTORY_STATUSES = [
  SESSION_STATUS.InProgress,
  SESSION_STATUS.Completed,
  SESSION_STATUS.Expired,
] as const;

export const SHOW_ANSWERS = {
  AfterItem: 'after_item',
  AfterSection: 'after_section',
  AfterSubmit: 'after_submit',
  Never: 'never',
} as const;

export const CONTENT_KIND = {
  Question: 'question',
  ListeningTask: 'listening_task',
  ReadingTask: 'reading_task',
} as const;

export const ENGINE_ADAPTER = {
  Question: 'question',
  ListeningTask: 'listening_task',
  ReadingTask: 'reading_task',
  ManualPrompt: 'manual_prompt',
  External: 'external',
} as const;

export const ANSWER_SHAPE = {
  Choice: 'choice',
  MultiChoice: 'multi_choice',
  Text: 'text',
  Audio: 'audio',
  Composite: 'composite',
  None: 'none',
} as const;

export const PASSING_MODE = {
  Percent: 'percent',
  Absolute: 'absolute',
  SectionMinimums: 'section_minimums',
  Manual: 'manual',
  Hybrid: 'hybrid',
} as const;

export const GRADER_KIND = {
  Auto: 'auto',
  Teacher: 'teacher',
  Ai: 'ai',
  External: 'external',
} as const;

export const REVIEW_ITEM_STATUS = {
  Active: 'active',
  Mastered: 'mastered',
  Dismissed: 'dismissed',
} as const;

export const PERSONAL_WORD_STATUS = {
  Saved: 'saved',
  Learning: 'learning',
  Learned: 'learned',
} as const;

export const ASSESSMENT_EXAM_SOURCE = {
  Assessment: 'assessment',
  ExamAcademy: 'exam_academy',
  ExamContent: 'exam_content',
} as const;

export type ContentStatus = (typeof CONTENT_STATUS)[keyof typeof CONTENT_STATUS];
export type CatalogStatus = (typeof CATALOG_STATUS)[keyof typeof CATALOG_STATUS];
export type SessionMode = (typeof SESSION_MODE)[keyof typeof SESSION_MODE];
export type SessionStatus = (typeof SESSION_STATUS)[keyof typeof SESSION_STATUS];
export type ShowAnswers = (typeof SHOW_ANSWERS)[keyof typeof SHOW_ANSWERS];
export type ContentKind = (typeof CONTENT_KIND)[keyof typeof CONTENT_KIND];
