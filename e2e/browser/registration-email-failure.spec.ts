import { test, expect } from '@playwright/test';
import { waitForLoginPage } from './api-helpers';

test.describe('Registration email failure', () => {
  test('@test.local shows error and stays on login page', async ({ page }) => {
    await waitForLoginPage(page);

    await page.getByRole('button', { name: 'Регистрация' }).click();
    await page.locator('input[placeholder="Янчиленко"]').fill('Test');
    await page.locator('input[placeholder="Мария"]').fill('User');
    await page.locator('input[type="email"]').fill(`fail-${Date.now()}@test.local`);
    await page.locator('input[type="password"]').fill('SecurePass123!');

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    await expect(page.getByText(/Не удалось отправить код подтверждения/i)).toBeVisible({
      timeout: 15_000,
    });
    await expect(page).not.toHaveURL(/auth\/pending-approval/);
    await expect(page.getByRole('heading', { name: 'Longhua Chinese' })).toBeVisible();
  });
});
