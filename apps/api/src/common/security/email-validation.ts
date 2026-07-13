const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com',
  'guerrillamail.com',
  'guerrillamail.net',
  'tempmail.com',
  'throwaway.email',
  'yopmail.com',
  '10minutemail.com',
  'trashmail.com',
  'fakeinbox.com',
  'getnada.com',
  'maildrop.cc',
  'dispostable.com',
]);

export const TEST_EMAIL_DOMAIN = 'test.local';

const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;

export function isTestEnvironment(): boolean {
  return process.env.NODE_ENV === 'test';
}

export function isProductionEnvironment(): boolean {
  return process.env.NODE_ENV === 'production';
}

export function getEmailDomain(email: string): string | null {
  const at = email.lastIndexOf('@');
  if (at < 0) {
    return null;
  }
  return email.slice(at + 1).trim().toLowerCase();
}

/**
 * Domain policy for user registration.
 * - test.local: allowed only when NODE_ENV=test
 * - other *.local: blocked in production (admin seed may use longhua.local in dev)
 * - disposable domains: always blocked
 */
export function isAllowedEmailDomain(domain: string): boolean {
  const normalized = domain.trim().toLowerCase();
  if (!normalized) {
    return false;
  }

  if (DISPOSABLE_DOMAINS.has(normalized)) {
    return false;
  }

  if (normalized === TEST_EMAIL_DOMAIN) {
    return isTestEnvironment();
  }

  if (normalized.endsWith('.local') && isProductionEnvironment()) {
    return false;
  }

  return true;
}

export function validateRegistrationEmail(email: string): string {
  const normalized = email.trim().toLowerCase();

  if (!EMAIL_PATTERN.test(normalized)) {
    throw new Error('Invalid email format');
  }

  const domain = getEmailDomain(normalized);
  if (!domain || !isAllowedEmailDomain(domain)) {
    if (domain === TEST_EMAIL_DOMAIN) {
      throw new Error('Email domain test.local is not allowed in this environment');
    }
    throw new Error('Disposable or invalid email domain is not allowed');
  }

  return normalized;
}
