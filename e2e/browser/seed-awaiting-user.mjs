import { createRequire } from 'module';
import { randomUUID } from 'crypto';

const require = createRequire(import.meta.url);
const bcrypt = require('../../apps/api/node_modules/bcryptjs');
const pg = require('../../apps/api/node_modules/pg');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/longhua';

/** Creates a verified user with empty role (UI: «Ожидает роли») without hitting register rate limits. */
export async function seedAwaitingRoleUser() {
  const suffix = randomUUID().slice(0, 8);
  const email = `awaiting-${suffix}@test.local`;
  const userId = randomUUID();
  const now = new Date();
  const passwordHash = bcrypt.hashSync('TestPass123!', 10);

  const client = new pg.Client({ connectionString: DATABASE_URL });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (
        id, email, password_hash, role, status, email_verified,
        verification_code, verification_attempts, verification_code_expires_at,
        verification_code_sent_at, first_name, last_name, phone,
        telegram_id, telegram_username, telegram_link_token, telegram_link_expires,
        created_date, updated_date
      ) VALUES (
        $1, $2, $3, '', 'active', true,
        NULL, 0, NULL, NULL, $4, $5, '', '', '', NULL, NULL, $6, $6
      )`,
      [userId, email.toLowerCase(), passwordHash, 'Await', `Role ${suffix}`, now],
    );
  } finally {
    await client.end();
  }

  return { id: userId, email };
}
