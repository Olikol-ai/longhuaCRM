import 'reflect-metadata';
import { validateEnv } from './env.validation';

function baseConfig(overrides: Record<string, unknown> = {}) {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/longhua',
    JWT_SECRET: 'a'.repeat(32),
    APP_PUBLIC_URL: 'https://crm.example.com',
    TELEGRAM_ENABLED: false,
    ...overrides,
  };
}

describe('validateEnv production hardening', () => {
  it('accepts strong JWT_SECRET in production', () => {
    expect(() => validateEnv(baseConfig())).not.toThrow();
  });

  it('rejects missing JWT_SECRET in production', () => {
    expect(() =>
      validateEnv(baseConfig({ JWT_SECRET: undefined })),
    ).toThrow(/JWT_SECRET must be set/);
  });

  it('rejects short JWT_SECRET in production', () => {
    expect(() =>
      validateEnv(baseConfig({ JWT_SECRET: 'too-short' })),
    ).toThrow(/at least 32 characters/);
  });

  it('rejects known weak JWT_SECRET markers in production', () => {
    expect(() =>
      validateEnv(baseConfig({ JWT_SECRET: `${'x'.repeat(20)}change-me${'y'.repeat(20)}` })),
    ).toThrow(/too weak/);
  });

  it('allows dev default secret outside production', () => {
    expect(() =>
      validateEnv({
        NODE_ENV: 'development',
        DATABASE_URL: 'postgresql://postgres:secret@localhost:5432/longhua',
      }),
    ).not.toThrow();
  });
});
