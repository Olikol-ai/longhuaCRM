import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('Admin full student access', () => {
  it('admin student scope is unfiltered; teacher contacts link to school students', () => {
    const access = read('apps/api/src/common/access/student-access.service.ts');
    const contacts = read(
      'apps/api/src/modules/teacher-student-contacts/teacher-student-contacts.service.ts',
    );
    const students = read('apps/api/src/modules/students/students.service.ts');

    assert.match(access, /if \(this\.isAdmin\(actor\)\)[\s\S]*return filterToEntityWhere/);
    assert.match(access, /listStudentsForPayments/);
    assert.doesNotMatch(
      access.slice(access.indexOf('async scopeStudentFilter')),
      /createdByUserId|ownerId|authorId|creatorId/,
    );

    assert.match(contacts, /createSchoolStudentForTeacherContact|linkedStudentId: student\.id/);
    assert.match(contacts, /ensureTeacherContactsLinkedToSchoolStudents/);
    assert.match(students, /ensureTeacherContactsLinkedToSchoolStudents/);
    assert.match(students, /isAdmin\(actor\).*ensureTeacherContacts|ensureTeacherContacts[\s\S]*isAdmin/);
  });
});
