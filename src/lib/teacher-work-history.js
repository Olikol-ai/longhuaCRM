/**
 * Shared filters for teacher homework / exam work history (SSOT from API rows).
 * Does not encode ACL — backend still scopes rows.
 */

export const HOMEWORK_REVIEW_STATUSES = new Set(['submitted']);

export const HOMEWORK_COMPLETED_STATUSES = new Set([
  'checked',
  'reviewed',
  'expired',
  'overdue',
  'cancelled',
]);

export function isHomeworkNeedsReview(row) {
  if (!row) return false;
  return (
    HOMEWORK_REVIEW_STATUSES.has(row.status) ||
    Boolean(row.needs_manual_review)
  );
}

export function isHomeworkCompleted(row) {
  if (!row) return false;
  if (HOMEWORK_COMPLETED_STATUSES.has(row.status)) return true;
  // Auto-checked may expose a percent while status lags; still treat as history.
  return (
    row.result_percent != null &&
    row.status !== 'assigned' &&
    row.status !== 'started' &&
    row.status !== 'in_progress' &&
    row.status !== 'submitted'
  );
}

/** tab: review | history | all */
export function filterHomeworkAssignments(assignments = [], tab = 'all') {
  const rows = Array.isArray(assignments) ? assignments : [];
  if (tab === 'review') return rows.filter(isHomeworkNeedsReview);
  if (tab === 'history') return rows.filter(isHomeworkCompleted);
  return rows;
}

export function isExamResultPending(result) {
  if (!result) return false;
  const status = result.status;
  return status === 'pending_review' || status === 'processing';
}

export function isExamResultCompleted(result) {
  if (!result) return false;
  return (
    result.status === 'passed' ||
    result.status === 'failed' ||
    result.passed === true
  );
}

/** tab: pending | completed | all | current (assignments without finished result) */
export function filterExamResults(results = [], tab = 'all') {
  const rows = Array.isArray(results) ? results : [];
  if (tab === 'pending') return rows.filter(isExamResultPending);
  if (tab === 'completed') return rows.filter(isExamResultCompleted);
  return rows;
}

export function isTeacherExamAssignmentCurrent(card) {
  if (!card) return false;
  const status = card.resultStatus;
  if (!status) return true;
  return status !== 'pending_review' && status !== 'passed' && status !== 'failed';
}
