import { test, expect } from '@playwright/test';
import { randomUUID } from 'crypto';
import { adminCredentials, apiLogin, apiRequest, loginViaApi } from './api-helpers';

function parseMoneyText(text: string): number {
  const cleaned = text.replace(/[^\d.,-]/g, '').replace(/\s/g, '');
  if (!cleaned) return 0;

  if (cleaned.includes(',') && cleaned.includes('.')) {
    // 1,234.56 (en) vs 1.234,56 (eu)
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      return Number(cleaned.replace(/\./g, '').replace(',', '.'));
    }
    return Number(cleaned.replace(/,/g, ''));
  }

  if (cleaned.includes(',')) {
    return Number(cleaned.replace(',', '.'));
  }

  return Number(cleaned);
}

test.describe('Revenue analytics UI', () => {
  test('sums 80 + 80 + 50 as 210.00 BYN in month revenue', async ({ page }) => {
    const admin = adminCredentials();
    const token = (await apiLogin(admin.email, admin.password)).token;
    const paymentDate = new Date().toISOString().split('T')[0];

    const studentRes = await apiRequest('/students', token, {
      method: 'POST',
      body: JSON.stringify({
        name: `PW Revenue ${randomUUID().slice(0, 8)}`,
        status: 'active',
      }),
    });
    expect(studentRes.ok).toBeTruthy();
    const student = (await studentRes.json()) as { id: string };

    await loginViaApi(page, admin.email, admin.password, '/AdminPanel');
    await page.getByRole('button', { name: 'Аналитика' }).click();

    const monthRevenueCard = page
      .locator('div.rounded-xl.border')
      .filter({ has: page.getByText('Выручка за месяц', { exact: true }) });
    await expect(monthRevenueCard).toBeVisible();
    const beforeText = (await monthRevenueCard.locator('p').first().textContent()) ?? '';
    const beforeValue = parseMoneyText(beforeText);

    for (const amount of [80, 80, 50]) {
      const paymentRes = await apiRequest('/payments', token, {
        method: 'POST',
        body: JSON.stringify({
          studentId: student.id,
          amount,
          status: 'paid',
          lessonsAdded: 1,
          paymentDate,
        }),
      });
      expect(paymentRes.ok).toBeTruthy();
    }

    await page.reload();
    await page.getByRole('button', { name: 'Аналитика' }).click();
    await expect(monthRevenueCard).toBeVisible();

    const afterText = (await monthRevenueCard.locator('p').first().textContent()) ?? '';
    const afterValue = parseMoneyText(afterText);

    expect(afterValue - beforeValue).toBeCloseTo(210, 2);
  });
});
