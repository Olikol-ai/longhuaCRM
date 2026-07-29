/**
 * Homework activity kinds (sections). Speaking/Writing reserved for future manual review.
 */
export enum HomeworkActivityKind {
  Test = 'test',
  Reading = 'reading',
  Listening = 'listening',
  Speaking = 'speaking',
  Writing = 'writing',
}

export enum HomeworkLifecycleStatus {
  Draft = 'draft',
  Published = 'published',
  Archived = 'archived',
}

/** Per-student assignment / submission lifecycle (UI statuses). */
export enum HomeworkAssignmentStatus {
  Assigned = 'assigned',
  InProgress = 'in_progress',
  Submitted = 'submitted',
  Reviewed = 'reviewed',
  Overdue = 'overdue',
  NeedsRevision = 'needs_revision',
}

export enum HomeworkAttemptStatus {
  Started = 'started',
  Submitted = 'submitted',
}
