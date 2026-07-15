import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaApi } from './api-helpers';

const require = createRequire(import.meta.url);
const bcrypt = require('../../apps/api/node_modules/bcryptjs');
const pg = require('../../apps/api/node_modules/pg');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/longhua';

async function seedTeacherAccount() {
  const suffix = randomUUID().slice(0, 8);
  const email = `pw-teacher-mats-${suffix}@test.local`;
  const password = 'TeacherPass123!';
  const userId = randomUUID();
  const teacherId = randomUUID();
  const now = new Date();
  const passwordHash = bcrypt.hashSync(password, 10);

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
        $1, $2, $3, 'teacher', 'active', true,
        NULL, 0, NULL, NULL, $4, $5, '', '', '', NULL, NULL, $6, $6
      )`,
      [userId, email.toLowerCase(), passwordHash, 'PW', `Teacher ${suffix}`, now],
    );
    await client.query(
      `INSERT INTO teachers (
        id, name, first_name, last_name, email, phone, hourly_rate,
        telegram_id, status, specializations, notes, user_id, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, '', 30, '', 'active', NULL, NULL, $6, $7, $7
      )`,
      [teacherId, `PW Teacher ${suffix}`, 'PW', `Teacher ${suffix}`, email.toLowerCase(), userId, now],
    );
  } finally {
    await client.end();
  }

  return { email, password, userId, teacherId };
}

test.describe('Teacher MaterialsHub white screen', () => {
  test('teacher can open MaterialsHub without page crash', async ({ page }) => {
    const teacher = await seedTeacherAccount();
    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on('pageerror', (err) => {
      pageErrors.push(String(err?.message || err));
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await loginViaApi(page, teacher.email, teacher.password, '/MaterialsHub');

    await expect(page.getByRole('heading', { name: 'Материалы уроков' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByTestId('materials-course-tree')).toBeVisible();
    await expect(page.getByTestId('admin-materials-empty').or(page.locator('table'))).toBeVisible();

    expect(pageErrors, `pageerrors: ${pageErrors.join(' | ')}`).toEqual([]);
  });
});
