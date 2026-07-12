import { test, expect } from '@playwright/test';
import { adminCredentials, loginViaUi, waitForLoginPage } from './api-helpers';
import { recordUiIssue } from './issue-tracker';

test.describe('Guest flow', () => {
  test('registration → verification page → login form', async ({ page }) => {
    const email = `guest-${Date.now()}@playwright.test`;
    const password = 'GuestPass123!';

    await waitForLoginPage(page);

    await page.getByRole('button', { name: 'Регистрация' }).click();
    await page.locator('input[placeholder="Янчиленко"]').fill('Playwright');
    await page.locator('input[placeholder="Мария"]').fill('Guest');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);

    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
    await expect(page).toHaveURL(/auth\/pending-approval/, { timeout: 15_000 });

    const codeInput = page.getByPlaceholder('000000');
    await expect(page.getByText(/подтвержд/i)).toBeVisible();
    await expect(codeInput).toBeVisible();

    const admin = adminCredentials();
    await loginViaUi(page, admin.email, admin.password);

    await page.waitForURL(/admin|Dashboard|teacher|student|pending/, { timeout: 20_000 });
    if (page.url().includes('/login')) {
      recordUiIssue('guest', 'admin-login', 'Admin login from login page failed after guest registration test', 'high');
    }
  });
});
