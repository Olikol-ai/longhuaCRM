import { chromium } from 'playwright';
import fs from 'fs';
import { assertNonProductionBase } from './assert-non-production-base.mjs';

const TOKEN = fs.readFileSync('/tmp/admin.jwt', 'utf8').trim();
const ids = JSON.parse(fs.readFileSync('/tmp/student-ids.json', 'utf8'));
const BASE = assertNonProductionBase(
  process.env.BASE_URL || 'http://127.0.0.1:3001',
  { scriptName: 'verify-user-edit-name' },
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const patches = [];
page.on('request', (req) => {
  if (req.method() === 'PATCH' && (req.url().includes('/api/students/') || req.url().includes('/api/users/'))) {
    patches.push({ url: req.url(), body: req.postData() });
  }
});
page.on('response', (res) => {
  if (res.request().method() === 'PATCH' && (res.url().includes('/api/students/') || res.url().includes('/api/users/'))) {
    console.log('RESP', res.status(), res.url().split('/api')[1]);
  }
});

await page.addInitScript((t) => localStorage.setItem('longhua_access_token', t), TOKEN);

async function runCase(oldName, newFirst, label) {
  patches.length = 0;
  await page.goto(`${BASE}/UserManagement`, { waitUntil: 'networkidle', timeout: 60000 });
  await page.waitForTimeout(800);
  const search = page.locator('input[type="search"]:visible').first();
  await search.fill(oldName);
  await page.waitForTimeout(1200);
  const row = page.locator('table tbody tr').filter({ hasText: oldName }).first();
  await row.click();
  await page.getByTestId('user-edit-first-name').fill(newFirst);
  await page.getByTestId('user-edit-last-name').fill('Verify');
  await page.getByTestId('user-edit-save').click();
  await page.waitForTimeout(2500);
  console.log(label, 'PATCHES', patches);
  const rows = await page.locator('table tbody tr').filter({ hasText: newFirst }).count();
  console.log(label, 'LIST_ROWS', rows);
  if (rows > 0) {
    await page.locator('table tbody tr').filter({ hasText: newFirst }).first().click();
    await page.waitForTimeout(400);
    console.log(label, 'REOPEN', {
      first: await page.getByTestId('user-edit-first-name').inputValue(),
      last: await page.getByTestId('user-edit-last-name').inputValue(),
    });
    await page.keyboard.press('Escape');
  }
}

const spMarker = `SPUI ${Date.now()}`;
await runCase(ids.sp.name, spMarker, 'STUDENT_PROFILE');

const accMarker = `AccUI ${Date.now()}`;
await runCase(ids.acc.name, accMarker, 'ACCOUNT_STUDENT');

await browser.close();
console.log('DONE', { spMarker, accMarker });
