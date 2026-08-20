import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Lesson balance zero save contract', () => {
  it('never treats numeric 0 as missing; teacher 1→0 sticks on Student', () => {
    const form = read('src/components/students/StudentFormDialog.jsx');
    const notebook = read('src/components/students/PrivateStudentsNotebook.jsx');
    const balanceSvc = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contact-balance.service.ts',
    );
    const contactsSvc = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contacts.service.ts',
    );
    const studentsSvc = read('apps/api/src/modules/students/students.service.ts');
    const spec = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contacts.spec.ts',
    );

    assert.match(form, /Number\.isFinite\(raw\)/);
    assert.doesNotMatch(form, /lesson_balance:\s*Number\(formData\.lesson_balance\)\s*\|\|/);
    assert.match(notebook, /Number\.isInteger\(newBalance\)/);
    assert.doesNotMatch(notebook, /newBalance\s*<\s*0/);
    assert.doesNotMatch(balanceSvc, /reconcileLinkedTeacherBalances/);
    assert.doesNotMatch(balanceSvc, /Math\.max\(\s*lockedContact\.lessonBalance/);
    assert.doesNotMatch(contactsSvc, /patch\.lessonBalance/);
    assert.doesNotMatch(studentsSvc, /balanceTouched/);
    assert.match(spec, /writes Student only|writes tutor_contact_balances only/);
  });
});
