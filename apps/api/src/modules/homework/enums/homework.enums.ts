/**
 * Homework activity kinds (sections).
 * Speaking / Writing use manual-review question types from the assessment bank.
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

/** Per-student assignment / submission lifecycle. */
export enum HomeworkAssignmentStatus {
  Assigned = 'assigned',
  Started = 'started',
  Submitted = 'submitted',
  Checked = 'checked',
  Expired = 'expired',
  Cancelled = 'cancelled',
  /** Returned to student for fixes (still active). */
  NeedsRevision = 'needs_revision',
}

export enum HomeworkAttemptStatus {
  Started = 'started',
  Submitted = 'submitted',
}
