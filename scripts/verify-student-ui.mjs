import { chromium } from 'playwright';
import fs from 'fs';
import { assertNonProductionBase } from './assert-non-production-base.mjs';

const TOKEN = fs.readFileSync('/tmp/admin.jwt', 'utf8').trim();
const BASE = assertNonProductionBase(
  process.env.BASE_URL || 'http://127.0.0.1:3001',
  { scriptName: 'verify-student-ui' },
);

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
const posts = [];
page.on('request', (req) => {
  if (req.method() === 'POST' && req.url().includes('/api/students')) {
    posts.push({ url: req.url(), body: req.postData() });
  }
  if (req.method() === 'PATCH' && req.url().includes('/api/students')) {
    posts.push({ url: req.url(), method: 'PATCH', body: req.postData() });
  }
});

await page.addInitScript((token) => {
  localStorage.setItem('longhua_access_token', token);
}, TOKEN);

await page.goto(`${BASE}/UserManagement`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1000);

// --- CREATE ---
await page.getByTestId('admin-create-student').click();
await page.waitForTimeout(800);
const createText = await page.locator('[role="dialog"]').last().innerText();
const createOk =
  createText.includes('Преподаватель') &&
  !createText.includes('Учитель') &&
  !createText.includes('Репетитор') &&
  !createText.includes('Преподаватель (школа)') &&
  !createText.includes('Репетитор (внешний)');
const options = await page.getByTestId('student-form-teacher').locator('option').allTextContents();
console.log('CREATE_OK', createOk);
console.log('CREATE_OPTIONS', options);

const name = `UI Verify ${Date.now()}`;
await page.locator('#student-form-name').fill(name);
await page.getByTestId('student-form-teacher').selectOption({ label: 'Янчиленко Мария' });
await page.getByRole('button', { name: 'Создать' }).click();
await page.waitForTimeout(2000);
console.log('CREATE_POSTS', posts);
const createBody = posts.find((p) => p.url.includes('/students') && !p.method)?.body;
console.log('CREATE_BODY', createBody);

// --- EDIT existing with teacher ---
await page.goto(`${BASE}/UserManagement`, { waitUntil: 'networkidle', timeout: 60000 });
await page.waitForTimeout(1000);
const row = page.locator('table tbody tr').filter({ hasText: 'Арсентий' }).first();
await row.click();
await page.waitForTimeout(1000);
const editText = await page.locator('[role="dialog"]').last().innerText();
const editSelect = page.getByTestId('user-edit-assigned-teacher');
const editValue = await editSelect.inputValue();
const editOptions = await editSelect.locator('option').allTextContents();
console.log('EDIT_HAS_PREPOD', editText.includes('Преподаватель'));
console.log('EDIT_NO_UCHITEL', !editText.includes('Учитель'));
console.log('EDIT_NO_REPETITOR_FIELD', !editText.includes('Репетитор (внешний)'));
console.log('EDIT_VALUE', editValue);
console.log('EDIT_OPTIONS', editOptions);
console.log('EDIT_SELECTED_LABEL', await editSelect.locator('option:checked').textContent());

// change teacher
await editSelect.selectOption({ label: 'Крылова Дарья' });
await page.getByRole('button', { name: 'Сохранить' }).click();
await page.waitForTimeout(2000);
console.log('PATCHES', posts.filter((p) => p.method === 'PATCH' || (p.body && p.body.includes('assignedTeacherId'))));

await browser.close();
