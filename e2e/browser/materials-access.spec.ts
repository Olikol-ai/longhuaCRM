import { test, expect } from '@playwright/test';
import { createRequire } from 'module';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaApi } from './api-helpers';

const require = createRequire(import.meta.url);
const bcrypt = require('../../apps/api/node_modules/bcryptjs');
const pg = require('../../apps/api/node_modules/pg');

const DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5432/longhua';

async function seedStudentWithAccount(label: string) {
  const suffix = randomUUID().slice(0, 8);
  const email = `pw-access-${label}-${suffix}@test.local`;
  const password = 'StudentPass123!';
  const userId = randomUUID();
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
        $1, $2, $3, 'student', 'active', true,
        NULL, 0, NULL, NULL, $4, $5, '', '', '', NULL, NULL, $6, $6
      )`,
      [userId, email.toLowerCase(), passwordHash, 'PW', `Access ${suffix}`, now],
    );
  } finally {
    await client.end();
  }

  return { email, password, userId, name: `PW Access ${label} ${suffix}` };
}

test.describe('Materials access grant UI', () => {
  test('admin grants material to student; student sees it on StudentLessonMaterials', async ({
    page,
    browser,
  }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const title = `PW Access Mat ${randomUUID().slice(0, 8)}`;
    const seeded = await seedStudentWithAccount('ui');

    const studentRes = await apiRequest('/students', token, {
      method: 'POST',
      body: JSON.stringify({
        name: seeded.name,
        userId: seeded.userId,
        status: 'active',
      }),
    });
    expect(studentRes.ok).toBeTruthy();
    const student = (await studentRes.json()) as { id: string };

    const courseRes = await apiRequest('/courses', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW Access Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
        totalLessons: 5,
      }),
    });
    expect(courseRes.ok).toBeTruthy();
    const course = (await courseRes.json()) as { id: string };

    const folderRes = await apiRequest('/materials/folders', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW Access Folder ${randomUUID().slice(0, 8)}`,
        courseTemplateId: course.id,
        sortOrder: 0,
      }),
    });
    expect(folderRes.ok).toBeTruthy();
    const folder = (await folderRes.json()) as { id: string };

    const materialRes = await apiRequest('/materials', token, {
      method: 'POST',
      body: JSON.stringify({
        folderId: folder.id,
        title,
        fileType: 'pdf',
        description: 'playwright access',
      }),
    });
    expect(materialRes.ok).toBeTruthy();
    const material = (await materialRes.json()) as { id: string };

    await loginViaApi(page, admin.email, admin.password, '/MaterialsHub');
    await expect(page.getByRole('heading', { name: 'Материалы уроков' })).toBeVisible();

    const materialCard = page.locator('tr.group').filter({ has: page.getByText(title, { exact: true }) });
    await expect(materialCard).toBeVisible({ timeout: 15_000 });
    await materialCard.locator('input[type="checkbox"]').first().check();

    await page.getByRole('button', { name: 'Предоставить доступ' }).click();
    await expect(page.getByRole('heading', { name: 'Выберите материалы' })).toBeVisible();
    await page.getByRole('button', { name: 'Далее' }).click();
    await expect(page.getByRole('heading', { name: 'Кому выдать доступ' })).toBeVisible();
    await page.getByRole('button', { name: 'Ученик' }).click();

    const studentRow = page.locator('label').filter({ hasText: seeded.name });
    await expect(studentRow).toBeVisible({ timeout: 15_000 });
    await studentRow.locator('input[type="checkbox"]').check();

    const grantResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes('/api/materials/access/grant')
        && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.locator('.fixed').getByRole('button', { name: 'Предоставить доступ' }).click();
    const grantRes = await grantResponse;
    expect(grantRes.ok()).toBeTruthy();

    // Admin: open access control list and verify recipient + source
    await materialCard.getByTitle('Управление доступом').click();
    await expect(page.getByTestId('access-control-modal')).toBeVisible();
    await expect(page.getByTestId('access-current-grants')).toBeVisible();
    await expect(page.getByText(seeded.name, { exact: false }).first()).toBeVisible();
    await expect(page.getByText('Персональный доступ').first()).toBeVisible();
    await page.getByRole('button', { name: 'Закрыть' }).click();

    const studentToken = (await apiLogin(seeded.email, seeded.password)).token;
    const listRes = await apiRequest('/materials', studentToken);
    expect(listRes.ok).toBeTruthy();
    const list = (await listRes.json()) as Array<{
      id: string;
      access_sources?: Array<{ type: string; label: string }>;
    }>;
    const studentMaterial = list.find((row) => row.id === material.id);
    expect(studentMaterial).toBeTruthy();
    expect(
      (studentMaterial?.access_sources || []).some(
        (src) => src.type === 'personal' || src.label === 'Персональный доступ',
      ),
    ).toBe(true);
    expect(student.id).toBeTruthy();

    // Fresh browser context — avoid admin session bleed when switching roles.
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    try {
      await loginViaApi(studentPage, seeded.email, seeded.password, '/StudentLessonMaterials');
      await expect(studentPage.getByRole('heading', { name: 'Мои материалы' })).toBeVisible({
        timeout: 15_000,
      });
      await expect(studentPage.getByText(title, { exact: true })).toBeVisible({ timeout: 20_000 });
      await expect(studentPage.getByText('Персональный доступ').first()).toBeVisible();
      await studentPage.getByTestId(`student-material-${material.id}`).click({ modifiers: [] });
    } finally {
      await studentContext.close();
    }
  });
});
