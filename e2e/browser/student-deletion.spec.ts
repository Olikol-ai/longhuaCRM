import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaUi } from './api-helpers';

test.describe('Student deletion UI', () => {
  test('deletes student with payment and shows deleted label on payments page', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const suffix = randomUUID().slice(0, 8);
    const studentName = `PW Del Student ${suffix}`;

    const teacherRes = await apiRequest('/teachers', token, {
      method: 'POST',
      body: JSON.stringify({ name: `PW Del Teacher ${suffix}`, status: 'active', hourlyRate: 20 }),
    });
    expect(teacherRes.ok).toBeTruthy();
    const teacher = (await teacherRes.json()) as { id: string };

    const studentRes = await apiRequest('/students', token, {
      method: 'POST',
      body: JSON.stringify({
        name: studentName,
        assignedTeacherId: teacher.id,
        status: 'active',
      }),
    });
    expect(studentRes.ok).toBeTruthy();
    const student = (await studentRes.json()) as { id: string };

    const lessonDate = new Date();
    lessonDate.setDate(lessonDate.getDate() + 14);
    const date = lessonDate.toISOString().split('T')[0];

    const paymentRes = await apiRequest('/payments', token, {
      method: 'POST',
      body: JSON.stringify({
        studentId: student.id,
        amount: 80,
        lessonsAdded: 2,
        status: 'paid',
        provider: 'manual',
        paymentDate: date,
      }),
    });
    expect(paymentRes.ok).toBeTruthy();
    const payment = (await paymentRes.json()) as { id: string };

    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/UserManagement');
    await page.getByRole('button', { name: 'Ученики' }).click();

    const row = page.locator('tr', { hasText: studentName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByTitle('Удалить').click();
    await page
      .locator('.fixed')
      .filter({ hasText: 'Удалить ученика' })
      .getByRole('button', { name: 'Удалить' })
      .click();

    await expect(page.locator('tr', { hasText: studentName })).toHaveCount(0, {
      timeout: 15_000,
    });

    await page.goto('/Payments');
    await expect(page.getByText('Удалённый ученик').first()).toBeVisible({
      timeout: 15_000,
    });

    const paymentCheck = await apiRequest(`/payments/${payment.id}`, token);
    expect(paymentCheck.ok).toBeTruthy();
    const paymentBody = (await paymentCheck.json()) as { student_id?: string | null };
    expect(paymentBody.student_id).toBeNull();
  });

  test('deletes student without dependencies from UI', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const suffix = randomUUID().slice(0, 8);
    const studentName = `PW Delete OK ${suffix}`;

    const studentRes = await apiRequest('/students', token, {
      method: 'POST',
      body: JSON.stringify({ name: studentName, status: 'active' }),
    });
    expect(studentRes.ok).toBeTruthy();

    await loginViaUi(page, admin.email, admin.password);
    await page.goto('/UserManagement');
    await page.getByRole('button', { name: 'Ученики' }).click();

    const row = page.locator('tr', { hasText: studentName });
    await expect(row).toBeVisible({ timeout: 15_000 });

    await row.getByTitle('Удалить').click();
    await page
      .locator('.fixed')
      .filter({ hasText: 'Удалить ученика' })
      .getByRole('button', { name: 'Удалить' })
      .click();

    await expect(page.locator('tr', { hasText: studentName })).toHaveCount(0, {
      timeout: 15_000,
    });
  });
});
