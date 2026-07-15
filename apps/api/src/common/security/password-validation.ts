/**
 * Single source of truth for registration / password-reset strength rules.
 * Used by DTO validators and Auth / PendingRegistration services.
 *
 * Rules:
 * - at least 6 characters
 * - at least one Latin letter (a–z / A–Z); Cyrillic alone does not count
 * - at least one digit (0–9)
 */
export const REGISTRATION_PASSWORD_MIN_LENGTH = 6;

/** User-facing hint (UI copy must stay aligned with this text). */
export const REGISTRATION_PASSWORD_HINT =
  'Минимум 6 символов, латинская буква и цифра';

export const REGISTRATION_PASSWORD_TOO_SHORT =
  'Пароль должен содержать не менее 6 символов.';

export const REGISTRATION_PASSWORD_WEAK =
  'Пароль должен содержать хотя бы одну латинскую букву и одну цифру.';

/**
 * Returns a Russian error message when the password violates policy, otherwise null.
 */
export function getRegistrationPasswordError(password: string): string | null {
  if (!password || password.length < REGISTRATION_PASSWORD_MIN_LENGTH) {
    return REGISTRATION_PASSWORD_TOO_SHORT;
  }
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return REGISTRATION_PASSWORD_WEAK;
  }
  return null;
}

export function validateRegistrationPassword(password: string): void {
  const error = getRegistrationPasswordError(password);
  if (error) {
    throw new Error(error);
  }
}
