import 'reflect-metadata';
import { getEmailDomain, TEST_EMAIL_DOMAIN, isAllowedEmailDomain, isProductionEnvironment, isTestEnvironment } from '../src/common/security/email-validation';
import { validateEnv } from '../src/config/env.validation';

describe('Email domain policy', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('allows test.local only in NODE_ENV=test', () => {
    process.env.NODE_ENV = 'test';
    expect(isTestEnvironment()).toBe(true);
    expect(isAllowedEmailDomain(TEST_EMAIL_DOMAIN)).toBe(true);

    process.env.NODE_ENV = 'production';
    expect(isProductionEnvironment()).toBe(true);
    expect(isAllowedEmailDomain(TEST_EMAIL_DOMAIN)).toBe(false);

    process.env.NODE_ENV = 'development';
    expect(isAllowedEmailDomain(TEST_EMAIL_DOMAIN)).toBe(false);
  });

  it('blocks disposable domains in every environment', () => {
    process.env.NODE_ENV = 'test';
    expect(isAllowedEmailDomain('mailinator.com')).toBe(false);
    process.env.NODE_ENV = 'production';
    expect(isAllowedEmailDomain('mailinator.com')).toBe(false);
  });

  it('blocks other .local domains in production', () => {
    process.env.NODE_ENV = 'production';
    expect(isAllowedEmailDomain('longhua.local')).toBe(false);
    process.env.NODE_ENV = 'development';
    expect(isAllowedEmailDomain('longhua.local')).toBe(true);
  });

  it('extracts domain from email', () => {
    expect(getEmailDomain('User@Example.COM')).toBe('example.com');
    expect(getEmailDomain('invalid')).toBeNull();
  });
});

describe('Production env validation', () => {
  const baseConfig = {
    DATABASE_URL: 'postgresql://postgres:postgres@localhost:5432/longhua',
    NODE_ENV: 'production',
    JWT_SECRET: 'production-secret',
    APP_PUBLIC_URL: 'https://crm.example.com',
  };

  it('rejects test.local admin email in production', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        ADMIN_EMAIL: 'admin@test.local',
      }),
    ).toThrow(/ADMIN_EMAIL|production email domain/i);
  });

  it('rejects localhost APP_PUBLIC_URL in production', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        APP_PUBLIC_URL: 'http://localhost:3001',
      }),
    ).toThrow(/APP_PUBLIC_URL|localhost/i);
  });

  it('accepts valid production config', () => {
    expect(() =>
      validateEnv({
        ...baseConfig,
        ADMIN_EMAIL: 'admin@example.com',
        MAIL_FROM: 'Longhua <noreply@example.com>',
        CORS_ORIGINS: 'https://crm.example.com',
        TELEGRAM_ENABLED: false,
      }),
    ).not.toThrow();
  });
});
