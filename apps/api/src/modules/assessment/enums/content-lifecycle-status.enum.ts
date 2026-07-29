/**
 * Content lifecycle for Bank, Question, ExamBlock, Exam.
 *
 * Domain names: DRAFT / ACTIVE / ARCHIVED.
 * `published` is the persisted ACTIVE value (backward compatible).
 */
export enum ContentLifecycleStatus {
  Draft = 'draft',
  /** ACTIVE — published and available for use. */
  Published = 'published',
  Archived = 'archived',
}

/** True when content is active (published) and can be composed/assigned. */
export function isActiveContentStatus(status: ContentLifecycleStatus | string): boolean {
  return status === ContentLifecycleStatus.Published;
}
