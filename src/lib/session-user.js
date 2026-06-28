import { isValidDashboardRole } from './auth-gate';

const VALID_ONBOARDING_STATES = new Set([
  'needs_verification',
  'awaiting_role',
  'active',
  'blocked',
]);

/** Module-level cache survives React StrictMode AuthProvider remounts. */
let inFlightEstablish = null;
let cachedToken = null;
let cachedUser = null;

/**
 * Single normalization point for /auth/me (and login) payloads.
 * Routing must depend only on these stable fields.
 */
export function normalizeSessionUser(raw) {
  if (!raw || typeof raw !== 'object') {
    throw Object.assign(new Error('Invalid session user payload'), { status: 401 });
  }

  const id = String(raw.id ?? '').trim();
  if (!id) {
    throw Object.assign(new Error('Session user missing id'), { status: 401 });
  }

  const role = isValidDashboardRole(raw.role) ? raw.role : null;
  const first_name = String(raw.first_name ?? raw.firstName ?? '').trim();
  const last_name = String(raw.last_name ?? raw.lastName ?? '').trim();
  const full_name = String(raw.full_name ?? raw.fullName ?? '').trim();
  const name =
    String(raw.name ?? '').trim()
    || full_name
    || (first_name && last_name ? `${last_name} ${first_name}` : first_name || last_name || '');

  const onboarding_state = VALID_ONBOARDING_STATES.has(raw.onboarding_state)
    ? raw.onboarding_state
    : VALID_ONBOARDING_STATES.has(raw.onboardingState)
      ? raw.onboardingState
      : null;

  const email = raw.email ? String(raw.email).trim() : '';

  return {
    id,
    email,
    role,
    first_name,
    last_name,
    name,
    full_name: full_name || name,
    onboarding_state,
    status: raw.status ?? null,
    redirect_path: raw.redirect_path ?? raw.redirectPath ?? null,
    phone: raw.phone ?? '',
    telegram_id: raw.telegram_id ?? raw.telegramId ?? '',
    telegram_username: raw.telegram_username ?? raw.telegramUsername ?? '',
  };
}

export function getCachedSessionUser(token) {
  if (token && cachedToken === token && cachedUser) {
    return cachedUser;
  }
  return null;
}

export function setCachedSessionUser(token, user) {
  cachedToken = token;
  cachedUser = user;
}

export function clearSessionCache() {
  cachedToken = null;
  cachedUser = null;
  inFlightEstablish = null;
}

export function getInFlightEstablish() {
  return inFlightEstablish;
}

export function setInFlightEstablish(promise) {
  inFlightEstablish = promise;
}

export function clearInFlightEstablish() {
  inFlightEstablish = null;
}

export function isActiveSessionWithInvalidRole(user) {
  return user?.onboarding_state === 'active' && !isValidDashboardRole(user?.role);
}
