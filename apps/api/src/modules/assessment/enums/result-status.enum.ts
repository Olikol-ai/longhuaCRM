/** Result scoring / review lifecycle. */
export enum ResultStatus {
  Processing = 'processing',
  PendingReview = 'pending_review',
  Passed = 'passed',
  Failed = 'failed',
  Invalidated = 'invalidated',
}
