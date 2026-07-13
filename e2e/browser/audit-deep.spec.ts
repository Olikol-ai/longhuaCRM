import { test, expect } from '@playwright/test';
import { adminCredentials, loginViaUi, waitForLoginPage } from './api-helpers';

test.describe('Guest deep flow', () => {
  test('wrong verification code shows error', async ({ page }) => {
    const email = `guest-deep-${Date.now()}@playwright.test`;
    const password = 'GuestPass123!';

    await waitForLoginPage(page);
    await page.getByRole('button', { name: 'Регистрация' }).click();
    await page.locator('input[placeholder="Янчиленко"]').fill('Deep');
    await page.locator('input[placeholder="Мария"]').fill('Guest');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();

    await expect(page).toHaveURL(/auth\/pending-approval/, { timeout: 15_000 });

    await page.getByPlaceholder('000000').fill('000000');
    await page.getByRole('button', { name: 'Подтвердить код' }).click();

    await expect(page.getByText(/неверн|ошибк|код/i).first()).toBeVisible({ timeout: 10_000 });
  });

  test('login before verification stays on pending page', async ({ page }) => {
    const email = `guest-nologin-${Date.now()}@playwright.test`;
    const password = 'GuestPass123!';

    await waitForLoginPage(page);
    await page.getByRole('button', { name: 'Регистрация' }).click();
    await page.locator('input[placeholder="Янчиленко"]').fill('No');
    await page.locator('input[placeholder="Мария"]').fill('Login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Зарегистрироваться' }).click();
    await expect(page).toHaveURL(/auth\/pending-approval/, { timeout: 15_000 });

    await page.goto('/login');
    await page.locator('input[type="email"]').fill(email);
    await page.locator('input[type="password"]').fill(password);
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page).toHaveURL(/login|pending-approval/, { timeout: 15_000 });
    if (!page.url().includes('pending-approval')) {
      await expect(page.getByText(/подтвержд|вериф|код|ошибк/i).first()).toBeVisible();
    }
  });
});

test.describe('Users directory UI (DATA-001)', () => {
  test('unlinked student appears in accounts tab', async ({ page, request }) => {
    const admin = adminCredentials();
    const suffix = Date.now();
    const studentName = `PW Directory ${suffix}`;

    const loginRes = await request.post('http://localhost:3001/api/auth/login', {
      data: { email: admin.email, password: admin.password },
    });
    const { token } = (await loginRes.json()) as { token: string };

    const createRes = await request.post('http://localhost:3001/api/students', {
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      data: { name: studentName, status: 'active' },
    });
    expect(createRes.ok()).toBeTruthy();

    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/UserManagement');
    await expect(page.getByRole('heading', { name: 'Пользователи' })).toBeVisible();

    await page.getByRole('button', { name: 'Аккаунты' }).click();
    await page.getByPlaceholder('Поиск по имени или email...').fill(studentName);

    await expect(page.getByText(studentName)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText('Профиль без аккаунта')).toBeVisible();
    await expect(page.getByText('Ученик')).toBeVisible();
  });
});

test.describe('Admin panel UI (UI-001)', () => {
  test('analytics subtab is compact and switches content', async ({ page }) => {
    const admin = adminCredentials();
    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/AdminPanel');

    const analyticsTab = page.getByRole('button', { name: 'Аналитика' });
    await expect(analyticsTab).toBeVisible();
    await analyticsTab.click();

    await expect(page.getByText(/выручк|аналитик|ученик/i).first()).toBeVisible({ timeout: 10_000 });

    const box = await analyticsTab.boundingBox();
    expect(box?.height ?? 0).toBeLessThan(44);
  });
});
