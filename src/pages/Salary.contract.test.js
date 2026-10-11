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

  it('defaults to previous calendar month and labels payout as Выплата за …', () => {
    assert.match(salarySource, /DEFAULT_MONTH/);
    assert.match(salarySource, /MONTHS\[1\]/);
    assert.match(salarySource, /Выплата за \$\{monthLabel\}/);
    assert.equal(salarySource.includes('day >= 15'), false);
  });

  it('edits current teachers.hourly_rate via teachers.get/update in expanded details', () => {
    assert.match(salarySource, /Текущая ставка/);
    assert.match(salarySource, /BYN\/час/);
    assert.match(salarySource, /salary-teacher-hourly-rate/);
    assert.match(salarySource, /api\.teachers\.get\(teacherId\)/);
    assert.match(salarySource, /api\.teachers\.update\(teacherId/);
    assert.match(salarySource, /hourly_rate:\s*hourlyRate/);
    assert.equal(salarySource.includes('api.teachers.list'), false);
    assert.equal(salarySource.includes('teacher_rate'), false);
    assert.equal(salarySource.includes('salary_rate'), false);
  });
});

describe('Admin salary access via AdminPanel tab', () => {
  const layoutSource = readFileSync(join(root, 'Layout.jsx'), 'utf8');
  const adminPanelSource = readFileSync(join(root, 'pages', 'AdminPanel.jsx'), 'utf8');
  const appSource = readFileSync(join(root, 'App.jsx'), 'utf8');

  it('does not put Зарплата in the global admin sidebar', () => {
    const adminNavMatch = layoutSource.match(/const adminNav = \[([\s\S]*?)\];/);
    assert.ok(adminNavMatch, 'adminNav must exist');
    assert.doesNotMatch(adminNavMatch[1], /name:\s*"Зарплата"/);
    assert.doesNotMatch(adminNavMatch[1], /AdminPanel\?tab=salary/);
    assert.doesNotMatch(adminNavMatch[1], /navKey:\s*"AdminPanelSalary"/);
    assert.match(adminNavMatch[1], /page:\s*"AdminPanel"/);
  });

  it('keeps Зарплата as an AdminPanel tab synced with ?tab=', () => {
    assert.match(adminPanelSource, /id:\s*"salary"/);
    assert.match(adminPanelSource, /label:\s*"Зарплата"/);
    assert.match(adminPanelSource, /activeTab === "salary" && <Salary/);
    assert.match(adminPanelSource, /setSearchParams/);
    assert.match(adminPanelSource, /selectTab/);
    assert.match(adminPanelSource, /next\.set\("tab", tabId\)/);
  });

  it('redirects legacy /TeacherPayments to AdminPanel salary tab for admin', () => {
    assert.match(appSource, /AdminPanel\?tab=salary/);
  });
});
