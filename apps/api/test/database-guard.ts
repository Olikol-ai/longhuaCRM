/**
 * Prevents accidental e2e/QA runs against the production PostgreSQL database.
 * Production CRM uses database name `longhua`; isolated tests must use `longhua_e2e`.
 */
export function parseDatabaseName(databaseUrl: string): string | null {
  const trimmed = String(databaseUrl || '').trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    const name = (parsed.pathname || '').replace(/^\//, '').split('/')[0]?.trim();
    return name || null;
  } catch {
    const match = trimmed.match(/\/([^/?]+)(?:\?|$)/);
    return match?.[1]?.trim() || null;
  }
}

export function isProductionLonghuaDatabase(databaseUrl: string): boolean {
  const name = parseDatabaseName(databaseUrl);
  return name === 'longhua';
}

/**
 * Throws unless DATABASE_URL targets an isolated test database.
 * Set ALLOW_PRODUCTION_TEST_DB=1 only for deliberate, read-only diagnostics.
 */
export function assertSafeTestDatabase(databaseUrl = process.env.DATABASE_URL): void {
  const url = String(databaseUrl || '').trim();
  if (!url) return;

  if (process.env.ALLOW_PRODUCTION_TEST_DB === '1') {
    return;
  }

  const name = parseDatabaseName(url);
  if (name === 'longhua') {
    throw new Error(
      'Refusing to run automated tests against production database "longhua". ' +
        'Use database "longhua_e2e" (default via setup-env.ts) or set ALLOW_PRODUCTION_TEST_DB=1 ' +
        'only for explicit, read-only diagnostics.',
    );
  }
}
