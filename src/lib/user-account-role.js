/**
 * Admin directory role display — uses API SSOT fields account_role + onboarding_state.
 */
export function displayRole(entry) {
  if (entry && typeof entry === 'object') {
    if (entry.account_role) {
      return entry.account_role;
    }
    if (entry.onboarding_state === 'awaiting_role') {
      return 'pending';
    }
    if (!entry.role) {
      return 'user';
    }
    return entry.role;
  }
  if (!entry) {
    return 'user';
  }
  return entry;
}
