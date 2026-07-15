/**
 * Display-only copy aligned with backend password policy:
 * apps/api/src/common/security/password-validation.ts
 *
 * Do NOT re-implement strength checks here — backend is the source of truth.
 */
export const REGISTRATION_PASSWORD_HINT =
  'Минимум 6 символов, латинская буква и цифра';
