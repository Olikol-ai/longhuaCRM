import { test, expect } from '@playwright/test';
import { waitForLoginPage } from './api-helpers';

test.describe('Guest flow', () => {
  test('registration tab shows form fields', async ({ page }) => {
    await waitForLoginPage(page);

    await page.getByRole('button', { name: 'Регистрация' }).click();
    await expect(page.locator('input[placeholder="Янчиленко"]')).toBeVisible();
    await expect(page.locator('input[placeholder="Мария"]')).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Зарегистрироваться' })).toBeVisible();
  });
});
