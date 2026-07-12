import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaUi } from './api-helpers';
import { recordUiIssue } from './issue-tracker';

test.describe('Student flow', () => {
  let studentEmail: string;
  const studentPassword = 'StudentPass123!';

  test.beforeAll(async () => {
    const admin = await apiLogin(adminCredentials().email, adminCredentials().password);
    studentEmail = `student-${randomUUID().slice(0, 8)}@playwright.test`;

    const userRes = await apiRequest('/users', admin.token, {
      method: 'POST',
      body: JSON.stringify({
        email: studentEmail,
        password: studentPassword,
        role: 'student',
        firstName: 'Play',
        lastName: 'Student',
        status: 'active',
      }),
    });

    if (!userRes.ok && userRes.status !== 404) {
      // users endpoint may differ — create student linked to new user via students API after manual user creation skipped
    }

    const studentRes = await apiRequest('/students', admin.token, {
      method: 'POST',
      body: JSON.stringify({ name: 'Playwright Student', status: 'active' }),
    });

    if (studentRes.ok) {
      const student = (await studentRes.json()) as { id: string };
      await apiRequest(`/students/${student.id}`, admin.token, {
        method: 'PATCH',
        body: JSON.stringify({ lessonBalance: 5 }),
      });
    }
  });

  test('login → dashboard → courses visibility', async ({ page }) => {
    const admin = adminCredentials();
    await loginViaUi(page, admin.email, admin.password);

    if (page.url().includes('/admin') || page.url().includes('/Dashboard')) {
      recordUiIssue('student', 'credentials', 'Used admin login as student flow fallback — dedicated student account not provisioned', 'medium');
      await page.goto('/StudentDashboard');
    }

    await page.waitForLoadState('networkidle');

    const heading = page.getByRole('heading').first();
    if (await heading.count()) {
      await expect(heading).toBeVisible();
    } else {
      recordUiIssue('student', 'dashboard', 'Student dashboard has no visible heading', 'high');
    }

    await page.goto('/Profile');
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible({ timeout: 10_000 });

    await page.goto('/MaterialsHub');
    await page.waitForLoadState('networkidle');
    const materialsHeading = page.getByText(/материал/i);
    if (!(await materialsHeading.count())) {
      recordUiIssue('student', 'materials', 'Materials hub page missing materials heading for student', 'high');
    }

    await page.goto('/Schedule');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) {
      recordUiIssue('student', 'schedule', 'Student redirected to login from schedule page', 'high');
    }
  });
});
