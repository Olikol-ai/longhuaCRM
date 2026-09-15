import { chromium } from 'playwright';
import fs from 'fs';
import { assertNonProductionBase } from './assert-non-production-base.mjs';

const TOKEN = fs.readFileSync('/tmp/admin.jwt', 'utf8').trim();
const BASE = assertNonProductionBase(
  process.env.BASE_URL || 'http://127.0.0.1:3001',
  { scriptName: 'verify-balance-adjust-no-reason' },
);
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
const posts = [];
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('adjust-lessons')) {
    posts.push(req.postData());
  }
});
page.on('response', (res) => {
  if (res.url().includes('adjust-lessons')) {
    console.log('RESP', res.status());
  }
});
await page.addInitScript((t) => localStorage.setItem('longhua_access_token', t), TOKEN);
await page.goto(`${BASE}/Balance`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1000);
const body = await page.locator('body').innerText();
console.log('HAS_REASON_LABEL', /Причина|Напишите причину|причин/.test(body) && body.includes('Корректировка'));
// open first student row
const row = page.locator('table tbody tr').first();
await row.click();
await page.waitForTimeout(1200);
const dialogText = await page.locator('[role="dialog"], [data-state="open"]').last().innerText().catch(async () => page.locator('body').innerText());
console.log('DIALOG_HAS_REASON_FIELD', dialogText.includes('Причина') || dialogText.includes('Напишите причину'));
console.log('DIALOG_HAS_NEW_BALANCE', dialogText.includes('Новый остаток'));
await page.getByTestId('balance-adjust-new-value').fill('3');
await page.getByTestId('balance-adjust-save').click();
await page.waitForTimeout(2000);
console.log('POST_BODY', posts);
console.log('SUCCESS_NO_REASON', posts.some((b) => {
  const j = JSON.parse(b || '{}');
  return j.newBalance === 3 && (j.reason == null || j.reason === undefined || j.reason === '');
}));
await browser.close();
