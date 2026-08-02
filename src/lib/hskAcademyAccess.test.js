import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canAccessHskAcademy,
  canManageHskAcademyContent,
  HSK_ACADEMY_ROLES,
  HSK_ACADEMY_STAFF_ROLES,
} from './hskAcademyAccess.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('hskAcademyAccess (school Longhua only)', () => {
  it('allows admin, teacher, student; denies tutor and tutor_student', () => {
    assert.deepEqual(HSK_ACADEMY_ROLES, ['admin', 'teacher', 'student']);
    assert.equal(canAccessHskAcademy('admin'), true);
    assert.equal(canAccessHskAcademy('teacher'), true);
    assert.equal(canAccessHskAcademy('student'), true);
    assert.equal(canAccessHskAcademy('tutor'), false);
    assert.equal(canAccessHskAcademy('tutor_student'), false);
  });

  it('staff content roles exclude tutors and students', () => {
    assert.deepEqual(HSK_ACADEMY_STAFF_ROLES, ['admin', 'teacher']);
    assert.equal(canManageHskAcademyContent('admin'), true);
    assert.equal(canManageHskAcademyContent('teacher'), true);
    assert.equal(canManageHskAcademyContent('student'), false);
    assert.equal(canManageHskAcademyContent('tutor'), false);
  });

  it('SPA routing deny-lists tutors on Academy and Exam Content', () => {
    const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
    for (const path of [
      '/HskAcademy',
      '/HskAcademyPractice',
      '/HskAcademyMock',
      '/HskAcademyPreparation',
      '/HskAcademyTake',
      '/HskAcademyResult',
      '/ExamContent',
      '/ExamContentBank',
    ]) {
      const line = routing.split('\n').find((l) => l.includes(`'${path}'`));
      assert.ok(line, `missing allowlist for ${path}`);
      assert.match(line, /'admin'/);
      assert.match(line, /'teacher'/);
      assert.doesNotMatch(line, /'tutor'/);
      assert.doesNotMatch(line, /tutor_student/);
      if (path.startsWith('/ExamContent') || path === '/HskAcademyBank') {
        assert.doesNotMatch(line, /'student'/);
      } else if (path.startsWith('/HskAcademy')) {
        assert.match(line, /'student'/);
      }
    }
  });

  it('tutor menu has no HSK Academy / Exam Content entries', () => {
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    const tutorBlock = layout.slice(
      layout.indexOf('const tutorNav'),
      layout.indexOf('const studentNav'),
    );
    assert.doesNotMatch(tutorBlock, /HskAcademy/);
    assert.doesNotMatch(tutorBlock, /ExamContent/);
    assert.doesNotMatch(tutorBlock, /HSK Academy/);

    const tutorStudentBlock = layout.slice(
      layout.indexOf('const tutorStudentNav'),
      layout.indexOf('const NAV_BY_ROLE'),
    );
    assert.doesNotMatch(tutorStudentBlock, /HskAcademy/);
    assert.doesNotMatch(tutorStudentBlock, /ExamContent/);
  });

  it('API controllers enforce school roles', () => {
    const catalog = readFileSync(
      join(root, 'apps/api/src/modules/exam-academy/controllers/exam-academy-catalog.controller.ts'),
      'utf8',
    );
    const sessions = readFileSync(
      join(root, 'apps/api/src/modules/exam-academy/controllers/exam-academy-sessions.controller.ts'),
      'utf8',
    );
    const me = readFileSync(
      join(root, 'apps/api/src/modules/exam-academy/controllers/exam-academy-me.controller.ts'),
      'utf8',
    );
    const ecp = readFileSync(
      join(root, 'apps/api/src/modules/exam-content/controllers/exam-content.controller.ts'),
      'utf8',
    );
    const access = readFileSync(
      join(root, 'apps/api/src/modules/exam-content/services/exam-content-access.service.ts'),
      'utf8',
    );

    for (const src of [catalog, sessions, me]) {
      assert.match(src, /RolesGuard/);
      assert.match(src, /@Roles\('admin', 'teacher', 'student'\)/);
      assert.doesNotMatch(src, /'tutor'/);
    }
    assert.match(ecp, /RolesGuard/);
    assert.match(ecp, /@Roles\('admin', 'teacher'\)/);
    assert.doesNotMatch(ecp, /'tutor'/);
    assert.match(access, /canManageHskAcademyContent/);
    assert.doesNotMatch(access, /role === 'tutor'/);
  });
});
