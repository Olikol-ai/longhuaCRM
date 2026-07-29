import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildOwnerStudentRows,
  filterOwnerStudentRows,
  STUDENT_KIND,
} from './ownerStudents.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('ownerStudents helpers', () => {
  it('teacher: only CRM with User are registered; manual = contacts only', () => {
    const rows = buildOwnerStudentRows('teacher', {
      schoolStudents: [
        { id: 's1', name: 'Аня', user_id: 'u1', lesson_balance: 3, status: 'active' },
        // CRM without User must NOT appear as “manual” (contacts are the manual source).
        { id: 's2', name: 'Боря', userId: null, lesson_balance: 1, status: 'active' },
        // Inactive shell after student→tutor role change must not leak.
        {
          id: 's3',
          name: 'Канцавенко Ксения',
          userId: null,
          status: 'inactive',
          assigned_teacher_id: 't1',
        },
      ],
      contacts: [
        { id: 'c1', name: 'Вася', phone: '+375', lesson_balance: 5, status: 'active' },
      ],
    });

    assert.equal(rows.filter((r) => r.kind === STUDENT_KIND.REGISTERED).length, 1);
    assert.equal(rows.filter((r) => r.kind === STUDENT_KIND.MANUAL).length, 1);
    assert.ok(rows.some((r) => r.source === 'contact' && r.name === 'Вася' && r.canDelete));
    assert.equal(rows.some((r) => r.name === 'Канцавенко Ксения'), false);
    assert.equal(rows.some((r) => r.name === 'Боря'), false);
  });

  it('dedupes tutor notebook twins that match a contact name', () => {
    const rows = buildOwnerStudentRows('tutor', {
      contacts: [{ id: 'c1', name: 'Иван Иванов', lesson_balance: 2, status: 'active' }],
      tutorStudents: [
        { id: 't1', name: 'Иван Иванов', userId: null, status: 'active' },
        { id: 't2', name: 'Петр', user_id: 'u2', status: 'active', email: 'p@test.local' },
      ],
    });

    assert.equal(rows.length, 2);
    assert.ok(rows.some((r) => r.kind === STUDENT_KIND.REGISTERED && r.name === 'Петр'));
    assert.ok(rows.some((r) => r.source === 'contact' && r.kind === STUDENT_KIND.MANUAL));
    assert.equal(rows.filter((r) => r.source === 'tutor_student' && !r.user_id).length, 0);
  });

  it('filters by tab and query', () => {
    const rows = buildOwnerStudentRows('teacher', {
      schoolStudents: [
        { id: 's1', name: 'Анна', user_id: 'u1', status: 'active', lesson_balance: 0 },
      ],
      contacts: [{ id: 'c1', name: 'Борис', status: 'active', lesson_balance: 1 }],
    });
    assert.equal(filterOwnerStudentRows(rows, { tab: 'registered' }).length, 1);
    assert.equal(filterOwnerStudentRows(rows, { tab: 'manual' }).length, 1);
    assert.equal(filterOwnerStudentRows(rows, { tab: 'all', query: 'бор' }).length, 1);
  });
});

describe('Students UI contract', () => {
  it('exposes tabs and add-manual flow without creating User', () => {
    const page = readFileSync(
      join(root, 'src/components/students/PrivateStudentsNotebook.jsx'),
      'utf8',
    );
    assert.match(page, /Зарегистрированные/);
    assert.match(page, /Добавленные вручную/);
    assert.match(page, /Добавить ученика/);
    assert.match(page, /teacherStudentContacts\.createMine/);
    assert.match(page, /createMyStudent/);
    assert.match(page, /Архивировать/);
    assert.doesNotMatch(page, /api\.users\.create/);
    assert.doesNotMatch(page, /auth\.register/);
  });

  it('keeps teacher and tutor pages wired to the shared notebook', () => {
    const teacher = readFileSync(join(root, 'src/pages/TeacherStudents.jsx'), 'utf8');
    const tutor = readFileSync(join(root, 'src/pages/TutorStudents.jsx'), 'utf8');
    assert.match(teacher, /PrivateStudentsNotebook/);
    assert.match(teacher, /ownerType="teacher"/);
    assert.match(tutor, /PrivateStudentsNotebook/);
    assert.match(tutor, /ownerType="tutor"/);
  });

  it('teacher student ACL excludes inactive CRM shells', () => {
    const access = readFileSync(
      join(root, 'apps/api/src/common/access/student-access.service.ts'),
      'utf8',
    );
    assert.match(access, /Not\('inactive'\)/);
    assert.match(access, /referral history/);
  });
});
