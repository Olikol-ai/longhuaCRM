import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaUi } from './api-helpers';

test.describe('Teacher deletion UI', () => {
  test('deletes teacher with lessons and opens schedule without errors', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const suffix = randomUUID().slice(0, 8);
    const teacherName = `PW Force Delete ${suffix}`;

    const teacherRes = await apiRequest('/teachers', token, {
      method: 'POST',
      body: JSON.stringify({ name: teacherName, status: 'active', hourlyRate: 20 }),
    });
    expect(teacherRes.ok).toBeTruthy();
    const teacher = (await teacherRes.json()) as { id: string };

    const lessonDate = new Date();
    lessonDate.setDate(lessonDate.getDate() + 14);
    const date = lessonDate.toISOString().split('T')[0];
    const day = lessonDate.getDay();
    const dayOfWeek = day === 0 ? 6 : day - 1;

    await apiRequest('/schedule', token, {
      method: 'POST',
      body: JSON.stringify({
        teacherId: teacher.id,
        dayOfWeek,
        timeFrom: '08:00',
        timeTo: '20:00',
      }),
    });

    const studentRes = await apiRequest('/students', token, {
      method: 'POST',
      body: JSON.stringify({ name: `PW Del Student ${suffix}`, status: 'active' }),
    });
    expect(studentRes.ok).toBeTruthy();
    const student = (await studentRes.json()) as { id: string };

    const lessonRes = await apiRequest('/lessons', token, {
      method: 'POST',
      body: JSON.stringify({
        teacherId: teacher.id,
        primaryStudentId: student.id,
        date,
        startTime: '10:00',
        duration: 60,
        status: 'planned',
      }),
    });
    expect(lessonRes.ok).toBeTruthy();
    const lesson = (await lessonRes.json()) as { id: string };

    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/UserManagement');
    await page.getByRole('button', { name: 'Преподаватели' }).click();

    const row = page.locator('tr', { hasText: teacherName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByTitle('Удалить').click();
    await page
      .locator('.fixed')
      .filter({ hasText: 'Удалить преподавателя' })
      .getByRole('button', { name: 'Удалить' })
      .click();

    await expect(page.locator('tr', { hasText: teacherName })).toHaveCount(0, {
      timeout: 15_000,
    });

    await page.goto('/Schedule');
    await expect(page.getByText(/Преподаватель удалён|расписан/i).first()).toBeVisible({
      timeout: 15_000,
    });

    const lessonCheck = await apiRequest(`/lessons/${lesson.id}`, token);
    expect(lessonCheck.ok).toBeTruthy();
    const lessonBody = (await lessonCheck.json()) as { teacher_id?: string | null };
    expect(lessonBody.teacher_id).toBeNull();
  });

  test('deletes teacher without dependencies from UI', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const suffix = randomUUID().slice(0, 8);
    const teacherName = `PW Delete OK ${suffix}`;

    const teacherRes = await apiRequest('/teachers', token, {
      method: 'POST',
      body: JSON.stringify({ name: teacherName, status: 'active', hourlyRate: 20 }),
    });
    expect(teacherRes.ok).toBeTruthy();

    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/UserManagement');
    await page.getByRole('button', { name: 'Преподаватели' }).click();

    const row = page.locator('tr', { hasText: teacherName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByTitle('Удалить').click();
    await page
      .locator('.fixed')
      .filter({ hasText: 'Удалить преподавателя' })
      .getByRole('button', { name: 'Удалить' })
      .click();

    await expect(page.locator('tr', { hasText: teacherName })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
