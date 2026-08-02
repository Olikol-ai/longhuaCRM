import { PREPARATION_HISTORY_STATUSES, SESSION_STATUS } from '../constants';

export type PreparationDisplayStatus =
  | typeof SESSION_STATUS.InProgress
  | typeof SESSION_STATUS.Completed
  | typeof SESSION_STATUS.Expired;

/**
 * Pure rules for «Моя подготовка» history visibility.
 * A session appears only with engagement and an allowed status.
 */
export function shouldAppearInPreparationHistory(input: {
  status: string;
  hasEngagement: boolean;
}): boolean {
  if (!input.hasEngagement) return false;
  return (PREPARATION_HISTORY_STATUSES as readonly string[]).includes(input.status);
}

/**
 * Map internal session + attempt timeout into a user-facing display status.
 */
export function resolvePreparationDisplayStatus(input: {
  status: string;
  submitReason?: string | null;
}): PreparationDisplayStatus | null {
  if (input.status === SESSION_STATUS.Expired) return SESSION_STATUS.Expired;
  if (input.status === SESSION_STATUS.InProgress) return SESSION_STATUS.InProgress;
  if (input.status === SESSION_STATUS.Completed) {
    if (input.submitReason === 'timeout') return SESSION_STATUS.Expired;
    return SESSION_STATUS.Completed;
  }
  return null;
}
