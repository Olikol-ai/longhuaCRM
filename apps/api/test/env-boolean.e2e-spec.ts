import 'reflect-metadata';
import { parseEnvBoolean } from '../src/config/env-boolean';
import { validateEnv } from '../src/config/env.validation';

describe('parseEnvBoolean', () => {
  it('treats the string "false" as false', () => {
    expect(parseEnvBoolean('false')).toBe(false);
    expect(parseEnvBoolean('FALSE')).toBe(false);
    expect(parseEnvBoolean('0')).toBe(false);
    expect(parseEnvBoolean(false)).toBe(false);
  });

  it('treats the string "true" as true', () => {
    expect(parseEnvBoolean('true')).toBe(true);
    expect(parseEnvBoolean('1')).toBe(true);
    expect(parseEnvBoolean(true)).toBe(true);
  });
});

describe('validateEnv boolean coercion', () => {
  it('does not flip TELEGRAM_MOCK=false to true', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgres://localhost/longhua',
      TELEGRAM_MOCK: 'false',
      TELEGRAM_ENABLED: 'true',
      ENABLE_CRON: 'false',
      NODE_ENV: 'development',
    });

    expect(parsed.TELEGRAM_MOCK).toBe(false);
    expect(parsed.TELEGRAM_ENABLED).toBe(true);
    expect(parsed.ENABLE_CRON).toBe(false);
  });

  it('accepts TELEGRAM_MOCK=true', () => {
    const parsed = validateEnv({
      DATABASE_URL: 'postgres://localhost/longhua',
      TELEGRAM_MOCK: 'true',
      NODE_ENV: 'development',
    });
    expect(parsed.TELEGRAM_MOCK).toBe(true);
  });
});
