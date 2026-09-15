import { describe, expect, it } from '@jest/globals';
import {
  assertSafeTestDatabase,
  isProductionLonghuaDatabase,
  parseDatabaseName,
} from './database-guard';

describe('database-guard', () => {
  it('parses database name from DATABASE_URL', () => {
    expect(parseDatabaseName('postgresql://u:p@localhost:5432/longhua')).toBe('longhua');
    expect(parseDatabaseName('postgresql://u:p@localhost:5432/longhua_e2e?ssl=1')).toBe(
      'longhua_e2e',
    );
  });

  it('detects production longhua database', () => {
    expect(isProductionLonghuaDatabase('postgresql://localhost/longhua')).toBe(true);
    expect(isProductionLonghuaDatabase('postgresql://localhost/longhua_e2e')).toBe(false);
  });

  it('blocks tests on production database by default', () => {
    const prevUrl = process.env.DATABASE_URL;
    const prevAllow = process.env.ALLOW_PRODUCTION_TEST_DB;
    process.env.DATABASE_URL = 'postgresql://postgres:postgres@localhost:5432/longhua';
    delete process.env.ALLOW_PRODUCTION_TEST_DB;

    expect(() => assertSafeTestDatabase()).toThrow(/Refusing to run automated tests/);

    process.env.ALLOW_PRODUCTION_TEST_DB = '1';
    expect(() => assertSafeTestDatabase()).not.toThrow();

    process.env.DATABASE_URL = prevUrl;
    if (prevAllow === undefined) delete process.env.ALLOW_PRODUCTION_TEST_DB;
    else process.env.ALLOW_PRODUCTION_TEST_DB = prevAllow;
  });
});
