import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dashboardSource = readFileSync(
  join(root, 'components', 'dashboard', 'AdminDashboard.jsx'),
  'utf8',
);
const pageSource = readFileSync(
  join(root, 'pages', 'LowBalanceStudents.jsx'),
  'utf8',
);
const studentsApiSource = readFileSync(
  join(root, 'api', 'students.api.js'),
  'utf8',
);
const appSource = readFileSync(join(root, 'App.jsx'), 'utf8');

describe('Low-balance students UI contract', () => {
  it('dashboard button says Просмотреть and opens LowBalanceStudents', () => {
    assert.match(dashboardSource, /Просмотреть/);
    assert.match(dashboardSource, /LowBalanceStudents/);
    assert.match(dashboardSource, /counts\.low_balance_students|low_balance_students/);
    assert.match(dashboardSource, /api\.dashboard|adminSummary/);
    assert.equal(
      dashboardSource.includes('to="/UserManagement"'),
      false,
    );
    assert.equal(dashboardSource.includes('>View<'), false);
    assert.equal(
      /isLowLessonBalance|lesson_balance.*<=\s*2/.test(dashboardSource),
      false,
    );
    assert.equal(dashboardSource.includes('students.lowBalance('), false);
  });

  it('dedicated page loads only low-balance API and shows required columns', () => {
    assert.match(pageSource, /Ученики с низким остатком занятий/);
    assert.match(pageSource, /students\.lowBalance\(/);
    assert.match(pageSource, /Осталось занятий/);
    assert.match(pageSource, /Контакты/);
    assert.equal(pageSource.includes('students.list('), false);
  });

  it('API client and route are registered', () => {
    assert.match(studentsApiSource, /\/students\/low-balance/);
    assert.match(appSource, /LowBalanceStudents/);
    assert.match(appSource, /path="\/LowBalanceStudents"/);
  });
});
