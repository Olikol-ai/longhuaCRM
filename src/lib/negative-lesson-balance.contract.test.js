import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('negative lesson balance integrity', () => {
  it('student DTOs allow negative integers without @Min(0)', () => {
    const create = read('apps/api/src/modules/students/dto/create-student.dto.ts');
    const update = read('apps/api/src/modules/students/dto/update-student.dto.ts');
    assert.match(create, /lessonBalance/);
    assert.match(update, /lessonBalance/);
    assert.doesNotMatch(create, /lessonBalance[\s\S]{0,80}@Min\(0\)/);
    assert.doesNotMatch(update, /lessonBalance[\s\S]{0,80}@Min\(0\)/);
    assert.match(create, /may be negative|Never constrain/i);
    assert.match(update, /may be negative|Never constrain/i);
  });

  it('balance arithmetic never floors at zero', () => {
    const studentBalance = read('apps/api/src/modules/students/student-balance.service.ts');
    const payments = read('apps/api/src/modules/payments/payments.service.ts');
    const contactBalance = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contact-balance.service.ts',
    );
    assert.match(studentBalance, /lessonBalance = \(student\.lessonBalance \?\? 0\) - 1/);
    assert.doesNotMatch(studentBalance, /Math\.max\(0,\s*\(student\.lessonBalance/);
    assert.doesNotMatch(payments, /nextBalance\s*<\s*0/);
    assert.doesNotMatch(contactBalance, /Math\.max\(\s*0,/);
  });

  it('FE balance input has no min=0 clamp', () => {
    const form = read('src/components/students/StudentFormDialog.jsx');
    const balanceBlock = form.slice(
      form.indexOf('Баланс уроков'),
      form.indexOf('Баланс уроков') + 500,
    );
    assert.doesNotMatch(balanceBlock, /min=\{0\}/);
    assert.doesNotMatch(balanceBlock, /min="0"/);
  });
});
