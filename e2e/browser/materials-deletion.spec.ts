import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaApi } from './api-helpers';

test.describe('Materials deletion UI', () => {
  test('deletes unused material from MaterialsHub', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const title = `PW Delete Mat ${randomUUID().slice(0, 8)}`;

    const courseRes = await apiRequest('/courses', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW Mat Course ${randomUUID().slice(0, 8)}`,
        courseType: 'basic_beginner',
        totalLessons: 5,
      }),
    });
    expect(courseRes.ok).toBeTruthy();
    const course = (await courseRes.json()) as { id: string };

    const folderRes = await apiRequest('/materials/folders', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW Folder ${randomUUID().slice(0, 8)}`,
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
        description: 'playwright delete',
      }),
    });
    expect(materialRes.ok).toBeTruthy();
    const material = (await materialRes.json()) as { id: string };

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });

    await loginViaApi(page, admin.email, admin.password, '/MaterialsHub');
    await expect(page.getByRole('heading', { name: 'Материалы уроков' })).toBeVisible();
    await page.getByRole('button', { name: 'Материалы', exact: true }).click();

    const deleteResponse = page.waitForResponse(
      (resp) =>
        resp.url().includes(`/api/materials/${material.id}`)
        && resp.request().method() === 'DELETE',
      { timeout: 20_000 },
    );

    const materialCard = page.locator('.group').filter({ has: page.getByText(title, { exact: true }) });
    await expect(materialCard).toBeVisible({ timeout: 15_000 });
    await materialCard.getByTitle('Удалить').click();

    const response = await deleteResponse;
    expect(response.ok()).toBeTruthy();
    const body = (await response.json()) as { success?: boolean; mode?: string };
    expect(body.success).toBe(true);

    await expect(page.getByText(title, { exact: true })).toHaveCount(0, { timeout: 15_000 });
  });
});
