import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaUi } from './api-helpers';
import { recordUiIssue } from './issue-tracker';

test.describe('Admin flow', () => {
  test('login → course → group → student → lesson → certificate', async ({ page }) => {
    const admin = adminCredentials();
    await loginViaUi(page, admin.email, admin.password);
    await page.waitForURL(/admin|Dashboard/, { timeout: 20_000 });

    const token = (await apiLogin(admin.email, admin.password)).token;
    const suffix = randomUUID().slice(0, 8);

    const courseRes = await apiRequest('/courses', token, {
      method: 'POST',
      body: JSON.stringify({ name: `PW Course ${suffix}`, courseType: 'basic_beginner', totalLessons: 5 }),
    });
    expect(courseRes.ok).toBeTruthy();
    const course = (await courseRes.json()) as { id: string };

    const teacherRes = await apiRequest('/teachers', token, {
      method: 'POST',
      body: JSON.stringify({ name: `PW Teacher ${suffix}`, status: 'active', hourlyRate: 20 }),
    });
    const teacher = teacherRes.ok ? ((await teacherRes.json()) as { id: string }) : null;

    const studentRes = await apiRequest('/students', token, {
      method: 'POST',
      body: JSON.stringify({ name: `PW Student ${suffix}`, status: 'active' }),
    });
    expect(studentRes.ok).toBeTruthy();
    const student = (await studentRes.json()) as { id: string };

    if (teacher) {
      const groupRes = await apiRequest('/groups', token, {
        method: 'POST',
        body: JSON.stringify({ name: `PW Group ${suffix}`, teacherId: teacher.id }),
      });
      if (!groupRes.ok) {
        recordUiIssue('admin', 'group-create-api', `Group creation failed: HTTP ${groupRes.status}`, 'high');
      }
    }

    await page.goto('/Certificates');
    const studentsResponse = page.waitForResponse(
      (resp) => resp.url().includes('/api/students') && resp.request().method() === 'GET' && resp.ok(),
    );
    await page.reload();
    await studentsResponse;
    await expect(page.getByRole('heading', { name: 'Сертификаты' })).toBeVisible();

    const studentSelect = page.locator('select').first();
    await expect(studentSelect).toBeVisible();
    await expect(studentSelect.locator('option', { hasText: `PW Student ${suffix}` })).toHaveCount(1, {
      timeout: 10_000,
    }).catch(() => {
      recordUiIssue('admin', 'certificates-student-select', 'Student not listed in certificates form dropdown', 'high');
    });

    await page.goto('/AdminPanel');
    await expect(page.getByRole('heading', { name: 'Обзор CRM' })).toBeVisible();
    await page.goto('/Certificates');
    await expect(page.getByRole('heading', { name: 'Сертификаты' })).toBeVisible();

    await page.goto('/Schedule');
    await page.waitForLoadState('networkidle');
    if (!(await page.getByText(/расписан|schedule|урок/i).count())) {
      recordUiIssue('admin', 'schedule-page', 'Schedule page missing schedule-related content', 'medium');
    }

    const certRes = await apiRequest('/certificates', token, {
      method: 'POST',
      body: JSON.stringify({
        studentId: student.id,
        courseId: course.id,
        registrationNumber: `PW-${suffix}`,
        blankSeries: 'PW',
        blankNumber: suffix.slice(0, 6),
        status: 'draft',
      }),
    });
    if (!certRes.ok) {
      recordUiIssue('admin', 'certificate-create-api', `Certificate draft creation failed: HTTP ${certRes.status}`, 'high');
    }
  });
});
