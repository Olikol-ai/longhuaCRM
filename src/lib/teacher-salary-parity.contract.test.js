import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const serviceSource = readFileSync(
  join(
    root,
    'apps/api/src/modules/teacher-payments/teacher-payments.service.ts',
  ),
  'utf8',
);

describe('Admin vs teacher salary calculation parity contract', () => {
  it('teacher my/periods uses canonical getMonthlyLessonDetails (not raw payment sum)', () => {
    const findMyPeriodsBlock = serviceSource.match(
      /async findMyPeriods\([\s\S]*?\n  async update\(/,
    )?.[0];
    assert.ok(findMyPeriodsBlock, 'findMyPeriods must exist');
    assert.match(findMyPeriodsBlock, /getMonthlyLessonDetails\(/);
    assert.doesNotMatch(findMyPeriodsBlock, /aggregateTeacherPaymentsByPeriod\(/);
    assert.doesNotMatch(findMyPeriodsBlock, /findMyPayments\(/);
  });

  it('admin summary and details share resolveLessonTeacherAmount', () => {
    assert.match(serviceSource, /resolveLessonTeacherAmount\(/);
    assert.match(serviceSource, /async getMonthlySummary\(/);
    assert.match(serviceSource, /async getMonthlyLessonDetails\(/);
  });
});
