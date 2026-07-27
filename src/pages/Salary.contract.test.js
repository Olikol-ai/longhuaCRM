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

const LEGACY_UI_STRINGS = [
  'Начисления по урокам',
  'Записи из реестра выплат после завершённых уроков',
  'реестра выплат',
  'Записи из реестра',
  'Поурочные начисления',
  'реестр начислений',
  'Расчёт за проведённые уроки и реестр начислений',
];

const LEGACY_API_CALLS = [
  'teacherPayments.list(',
  'teacherPayments.filter(',
  'teacherPayments.update(',
  'teacherPayments.create(',
  'api.lessons.list',
  'api.teachers.list',
  'paymentRows',
  'aggregateTeacherPaymentsByPeriod',
];

describe('Salary page monthly summary contract', () => {
  it('must not contain legacy per-lesson payout UI copy', () => {
    for (const text of LEGACY_UI_STRINGS) {
      assert.equal(
        salarySource.includes(text),
        false,
        `Salary.jsx must not contain: ${text}`,
      );
    }
  });

  it('loads salary only from monthly summary API', () => {
    assert.match(salarySource, /teacherPayments\.summary\(/);
    assert.match(salarySource, /teacherPayments\.summaryDetails\(/);
    assert.match(salarySource, /teacherPayments\.markMonthPaid\(/);
    for (const call of LEGACY_API_CALLS) {
      assert.equal(
        salarySource.includes(call),
        false,
        `Salary.jsx must not call legacy API: ${call}`,
      );
    }
  });

  it('teacher-payments client exposes only summary-oriented methods (no CRUD list)', () => {
    assert.match(paymentsApiSource, /\/teacher-payments\/summary/);
    assert.match(paymentsApiSource, /summaryDetails/);
    assert.match(paymentsApiSource, /markMonthPaid/);
    assert.equal(paymentsApiSource.includes('createDomainClient'), false);
    assert.equal(paymentsApiSource.includes('...client'), false);
    assert.equal(paymentsApiSource.includes('list('), false);
    assert.equal(paymentsApiSource.includes('filter('), false);
    assert.equal(paymentsApiSource.includes('.update('), false);
  });

  it('renders monthly table columns and payout actions', () => {
    assert.match(salarySource, /Зарплата преподавателей/);
    assert.match(salarySource, /Количество занятий/);
    assert.match(salarySource, /Статус выплаты/);
    assert.match(salarySource, /Итого к выплате/);
    assert.match(salarySource, /Подробнее/);
    assert.match(salarySource, /Выплатить/);
  });
});
