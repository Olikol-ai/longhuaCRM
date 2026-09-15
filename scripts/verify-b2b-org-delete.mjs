import { chromium } from 'playwright';
import fs from 'fs';
import { assertNonProductionBase } from './assert-non-production-base.mjs';

const TOKEN = fs.readFileSync('/tmp/admin.jwt', 'utf8').trim();
const BASE = assertNonProductionBase(
  process.env.BASE_URL || 'http://127.0.0.1:3001',
  { scriptName: 'verify-b2b-org-delete' },
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.addInitScript((t) => localStorage.setItem('longhua_access_token', t), TOKEN);
await page.goto(`${BASE}/B2bSales`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1000);

const empty = await page.getByText('Нет организаций').isVisible().catch(() => false);
console.log('EMPTY_AFTER_PURGE', empty || (await page.locator('body').innerText()).includes('Нет организаций'));

const name = `UI Org ${Date.now()}`;
await page.getByPlaceholder('Наименование').fill(name);
await page.getByRole('button', { name: 'Создать' }).click();
await page.waitForTimeout(1500);
console.log('CREATED_VISIBLE', await page.getByText(name).isVisible());

await page.getByRole('button', { name: 'Удалить' }).first().click();
await page.waitForTimeout(400);
console.log('CONFIRM_TITLE', await page.getByText('Удалить организацию?').isVisible());
await page.getByRole('button', { name: 'Удалить' }).last().click();
await page.waitForTimeout(1500);
console.log('GONE_AFTER_DELETE', !(await page.getByText(name).isVisible().catch(() => false)));

await page.reload({ waitUntil: 'networkidle' });
await page.waitForTimeout(1000);
console.log('GONE_AFTER_REFRESH', !(await page.getByText(name).isVisible().catch(() => false)));
console.log('EMPTY_OR_NO_NAME', !(await page.getByText(name).count()));

await browser.close();
