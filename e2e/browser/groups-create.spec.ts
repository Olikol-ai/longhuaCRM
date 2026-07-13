import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaApi } from './api-helpers';

test.describe('Group creation UI', () => {
  test('creates group and opens workspace with all tabs', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;

    const teacherRes = await apiRequest('/teachers', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW Group Teacher ${randomUUID().slice(0, 8)}`,
        status: 'active',
        hourlyRate: 20,
      }),
    });
    expect(teacherRes.ok).toBeTruthy();
    const teacher = (await teacherRes.json()) as { id: string; name: string };

    await loginViaApi(page, admin.email, admin.password, '/Groups');
    await expect(page.getByRole('heading', { name: 'Группы' })).toBeVisible();

    const groupName = `PW Group ${randomUUID().slice(0, 8)}`;
    await page.getByPlaceholder('Название группы').fill(groupName);
    await page.locator('select').first().selectOption(teacher.id);

    const createResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/groups') && resp.request().method() === 'POST',
      { timeout: 20_000 },
    );
    await page.getByRole('button', { name: 'Создать группу' }).click();
    const response = await createResponse;
    expect(response.ok()).toBeTruthy();

    await page.waitForURL(/\/Groups\/[0-9a-f-]+/i, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: groupName })).toBeVisible();

    for (const tab of ['Обзор', 'Ученики', 'Расписание', 'Уроки']) {
      await page.getByRole('button', { name: tab, exact: true }).click();
      await expect(page.getByRole('button', { name: tab, exact: true })).toBeVisible();
    }

    await page.getByRole('button', { name: 'Расписание', exact: true }).click();
    await expect(page.getByText('Создать расписание курса')).toBeVisible();
  });
});
