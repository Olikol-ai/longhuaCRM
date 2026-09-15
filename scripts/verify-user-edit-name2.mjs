import { chromium } from 'playwright';
import fs from 'fs';
import { assertNonProductionBase } from './assert-non-production-base.mjs';

const TOKEN = fs.readFileSync('/tmp/admin.jwt', 'utf8').trim();
const BASE = assertNonProductionBase(
  process.env.BASE_URL || 'http://127.0.0.1:3001',
  { scriptName: 'verify-user-edit-name2' },
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.addInitScript((t) => localStorage.setItem('longhua_access_token', t), TOKEN);
await page.goto(`${BASE}/UserManagement`, { waitUntil: 'networkidle' });
await page.locator('input[type="search"]:visible').first().fill('SPUI');
await page.waitForTimeout(1200);
const text = await page.locator('table tbody').innerText();
console.log('TABLE_SNIPPET', text.slice(0, 500));
const row = page.locator('table tbody tr').filter({ hasText: 'SPUI' }).first();
console.log('ROW_COUNT', await page.locator('table tbody tr').filter({ hasText: 'SPUI' }).count());
await row.click();
console.log('FORM', {
  first: await page.getByTestId('user-edit-first-name').inputValue(),
  last: await page.getByTestId('user-edit-last-name').inputValue(),
});
await browser.close();
