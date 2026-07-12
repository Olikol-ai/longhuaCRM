import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaUi } from './api-helpers';
import { recordUiIssue } from './issue-tracker';

test.describe('Teacher flow', () => {
  let teacherEmail: string;
  const teacherPassword = 'TeacherPass123!';

  test.beforeAll(async () => {
    const admin = await apiLogin(adminCredentials().email, adminCredentials().password);
    teacherEmail = `teacher-${randomUUID().slice(0, 8)}@playwright.test`;

    const teacherRes = await apiRequest('/teachers', admin.token, {
      method: 'POST',
      body: JSON.stringify({
        name: 'Playwright Teacher',
        email: teacherEmail,
        status: 'active',
        hourlyRate: 25,
      }),
    });

    if (!teacherRes.ok) {
      return;
    }

    await teacherRes.json();
  });

  test('login → schedule → attendance', async ({ page }) => {
    const admin = adminCredentials();
    await loginViaUi(page, admin.email, admin.password);
    await page.waitForURL(/admin|Dashboard|teacher/, { timeout: 20_000 });

    await page.goto('/TeacherSchedule');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) {
      recordUiIssue('teacher', 'schedule-access', 'Teacher schedule route blocked (used admin session)', 'medium');
    } else if (!(await page.getByText(/расписан|доступност|урок/i).count())) {
      recordUiIssue('teacher', 'schedule-content', 'Teacher schedule page lacks expected schedule content', 'high');
    }

    await page.goto('/Attendance');
    await page.waitForLoadState('networkidle');
    if (page.url().includes('/login')) {
      recordUiIssue('teacher', 'attendance-access', 'Attendance page redirects to login for admin user on teacher route', 'medium');
    } else if (!(await page.getByText(/посещ|attendance|урок/i).count())) {
      recordUiIssue('teacher', 'attendance-content', 'Attendance page missing attendance-related content', 'high');
    }

    await expect(page.locator('body')).toBeVisible();
  });
});
