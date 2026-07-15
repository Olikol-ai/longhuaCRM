import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { apiLogin, apiRequest, loginViaApi } from './api-helpers';

const require = createRequire(import.meta.url);
const bcrypt = require('../../apps/api/node_modules/bcryptjs');
const pg = require('../../apps/api/node_modules/pg');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/longhua';

async function seedTeacherAccount() {
  const suffix = randomUUID().slice(0, 8);
  const email = `pw-teacher-mats3-${suffix}@test.local`;
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

test.describe('Teacher MaterialsHub with own material', () => {
  test('teacher with own material opens MaterialsHub without crash', async ({ page }) => {
    const teacher = await seedTeacherAccount();
    const token = (await apiLogin(teacher.email, teacher.password)).token;

    const coursesRes = await apiRequest('/courses', token);
    expect(coursesRes.ok).toBeTruthy();
    const courses = (await coursesRes.json()) as Array<{ id: string }>;
    expect(courses.length).toBeGreaterThan(0);
    const courseId = courses[0].id;

    const folderRes = await apiRequest('/materials/folders', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW TFolder ${randomUUID().slice(0, 8)}`,
        courseTemplateId: courseId,
        sortOrder: 0,
      }),
    });
    const folderBodyText = await folderRes.text();
    expect(folderRes.ok, folderBodyText).toBeTruthy();
    const folder = JSON.parse(folderBodyText) as { id: string };

    const titleOwn = `PW Own Mat ${randomUUID().slice(0, 8)}`;
    const ownRes = await apiRequest('/materials', token, {
      method: 'POST',
      body: JSON.stringify({
        folderId: folder.id,
        title: titleOwn,
        fileType: 'link',
        fileUrl: 'https://example.com/teacher-own',
        description: 'teacher created',
      }),
    });
    const ownBodyText = await ownRes.text();
    expect(ownRes.ok, ownBodyText).toBeTruthy();

    const listRes = await apiRequest('/materials', token);
    const mats = (await listRes.json()) as Array<{
      title: string;
      access_sources?: Array<{ type: string; label: string }>;
      created_by_user_id?: string;
    }>;
    expect(mats.some((m) => m.title === titleOwn)).toBeTruthy();

    const foldersRes = await apiRequest('/materials/folders', token);
    const folders = await foldersRes.json();
    expect(Array.isArray(folders)).toBeTruthy();
    expect(folders.length).toBeGreaterThan(0);
    expect(folders.some((f: { id: string }) => f.id === folder.id)).toBeTruthy();

    const pageErrors: string[] = [];
    page.on('pageerror', (err) => pageErrors.push(String(err?.stack || err?.message || err)));

    await loginViaApi(page, teacher.email, teacher.password, '/MaterialsHub');
    await expect(page.getByRole('heading', { name: 'Материалы уроков' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(titleOwn, { exact: true })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('materials-course-tree')).toBeVisible();

    const fatal = pageErrors.filter((e) => !/Failed to fetch/i.test(e));
    expect(fatal, fatal.join('\n')).toEqual([]);
  });
});
