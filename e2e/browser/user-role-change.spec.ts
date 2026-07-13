import { test, expect } from '@playwright/test';
import { adminCredentials, apiLogin, apiRequest, loginViaApi } from './api-helpers';
import { seedAwaitingRoleUser } from './seed-awaiting-user.mjs';

test.describe('User role change UI', () => {
  test('assigns student role to awaiting-role user without infinite loading', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const awaitingUser = await seedAwaitingRoleUser();

    await loginViaApi(page, admin.email, admin.password, '/UserManagement');
    await page.getByRole('button', { name: 'Аккаунты' }).click();

    const row = page.locator('tr', { hasText: awaitingUser.email });
    await expect(row).toBeVisible({ timeout: 20_000 });
    await expect(row.getByText('Ожидает роли')).toBeVisible();

    const patchPromise = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/users/${awaitingUser.id}`)
        && resp.request().method() === 'PATCH',
      { timeout: 20_000 },
    );
    const reloadPromise = page.waitForResponse(
      (resp) => resp.url().includes('/api/users/directory') && resp.request().method() === 'GET',
      { timeout: 20_000 },
    );

    await row.getByRole('button', { name: /Сменить роль/i }).click();
    await page.getByRole('button', { name: 'Ученик', exact: true }).click();

    const patchResponse = await patchPromise;
    expect(patchResponse.ok()).toBeTruthy();
    await reloadPromise;

    await expect(page.locator('.p-6 .animate-spin')).toHaveCount(0, {
      timeout: 20_000,
    });
    await expect(row.getByText('Ученик')).toBeVisible({ timeout: 20_000 });

    const studentsRes = await apiRequest('/students', token);
    expect(studentsRes.ok).toBeTruthy();
    const students = (await studentsRes.json()) as Array<{ user_id?: string | null }>;
    expect(students.some((student) => student.user_id === awaitingUser.id)).toBeTruthy();
  });
});
