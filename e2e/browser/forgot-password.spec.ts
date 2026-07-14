import { test, expect } from '@playwright/test';
import { waitForLoginPage } from './api-helpers';

const GENERIC_SUCCESS =
  'Если такой email зарегистрирован, на него отправлена ссылка для восстановления пароля.';

test.describe('Forgot password UX', () => {
  test('login page shows "Забыли пароль?" and navigates to /forgot-password', async ({ page }) => {
    await waitForLoginPage(page);

    const link = page.getByTestId('forgot-password-link');
    await expect(link).toBeVisible();
    await expect(link).toHaveText('Забыли пароль?');

    await link.click();
    await expect(page).toHaveURL(/\/forgot-password$/);
    await expect(page.getByRole('heading', { name: 'Восстановление пароля' })).toBeVisible();
  });

  test('forgot-password form submits email and shows generic success', async ({ page }) => {
    await page.route('**/api/auth/forgot-password', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, message: GENERIC_SUCCESS }),
      });
    });

    await page.goto('/forgot-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Восстановление пароля' })).toBeVisible({
      timeout: 30_000,
    });

    await page.getByTestId('forgot-password-email').fill('anyone@example.com');
    await page.getByTestId('forgot-password-submit').click();

    await expect(page.getByTestId('forgot-password-success')).toBeVisible();
    await expect(page.getByTestId('forgot-password-success')).toContainText(GENERIC_SUCCESS);
  });

  test('reset-password handles missing token', async ({ page }) => {
    await page.goto('/reset-password', { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('reset-password-missing-token')).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByText(/недействительна или устарела/i)).toBeVisible();
  });

  test('reset-password form accepts token from query string', async ({ page }) => {
    await page.route('**/api/auth/reset-password', async (route) => {
      const body = route.request().postDataJSON() as {
        token?: string;
        password?: string;
        confirm_password?: string;
      };
      expect(body.token).toBe('test-reset-token-abc');
      expect(body.password).toBe('NewPass1');
      expect(body.confirm_password).toBe('NewPass1');
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          ok: true,
          message: 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.',
        }),
      });
    });

    await page.goto('/reset-password?token=test-reset-token-abc', {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.getByTestId('reset-password-form')).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId('reset-password-token')).toHaveValue('test-reset-token-abc');

    await page.getByTestId('reset-password-password').fill('NewPass1');
    await page.getByTestId('reset-password-confirm').fill('NewPass1');
    await page.getByTestId('reset-password-submit').click();

    await expect(page.getByTestId('reset-password-success')).toBeVisible();
    await expect(page.getByTestId('reset-password-success')).toContainText('Пароль успешно изменён');
  });
});
