import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const salarySource = readFileSync(join(root, 'pages', 'Salary.jsx'), 'utf8');
const paymentsApiSource = readFileSync(
  join(root, 'api', 'teacher-payments.api.js'),
  'utf8',
);

describe('Salary page monthly summary contract', () => {
  it('must not contain legacy per-lesson payout UI copy', () => {
    assert.equal(salarySource.includes('Начисления по урокам'), false);
    assert.equal(salarySource.includes('реестра выплат'), false);
    assert.equal(salarySource.includes('Записи из реестра'), false);
    assert.equal(salarySource.includes('Поурочные начисления'), false);
  });

  it('loads salary only from monthly summary API', () => {
    assert.match(salarySource, /teacherPayments\.summary\(/);
    assert.equal(salarySource.includes('teacherPayments.list('), false);
    assert.equal(salarySource.includes('api.lessons.list'), false);
    assert.equal(salarySource.includes('api.teachers.list'), false);
    assert.equal(salarySource.includes('paymentRows'), false);
  });

  it('exposes summary helpers on teacher-payments client', () => {
    assert.match(paymentsApiSource, /\/teacher-payments\/summary/);
    assert.match(paymentsApiSource, /summaryDetails/);
    assert.match(paymentsApiSource, /markMonthPaid/);
  });

  it('renders monthly table columns and payout actions', () => {
    assert.match(salarySource, /Количество занятий/);
    assert.match(salarySource, /Статус выплаты/);
    assert.match(salarySource, /Итого к выплате/);
    assert.match(salarySource, /Подробнее/);
    assert.match(salarySource, /Выплатить/);
  });
});
