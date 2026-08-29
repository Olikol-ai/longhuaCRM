import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('SPA route ACL (menu is not security)', () => {
  const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
  const forbidden = readFileSync(join(root, 'src/pages/Forbidden.jsx'), 'utf8');
  const adminRoute = readFileSync(join(root, 'src/components/auth/AdminRoute.jsx'), 'utf8');
  const roleGuard = readFileSync(join(root, 'src/components/auth/RoleRouteGuard.jsx'), 'utf8');
  const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
  const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');

  it('exposes Forbidden 403 UX and guards that deny by role, not by menu', () => {
    assert.match(forbidden, /403/);
    assert.match(forbidden, /Недостаточно прав/);
    assert.match(adminRoute, /ForbiddenPage/);
    assert.match(adminRoute, /PathAccessGuard/);
    assert.match(adminRoute, /RoleGuard/);
    assert.match(roleGuard, /isPathForbiddenForUser/);
    assert.match(roleGuard, /ForbiddenPage/);
    assert.match(routing, /Menu visibility is NOT security/);
  });

  it('does not grant tutors every teacher-only path', () => {
    assert.match(routing, /'\/TeacherAssessment': \['admin', 'teacher'\]/);
    assert.match(routing, /'\/TeacherDashboard': \['admin', 'teacher'\]/);
    assert.doesNotMatch(
      routing,
      /if \(required === 'teacher'\)[\s\S]*tutor/,
    );
  });

  it('allowlists protected pages from the audit list', () => {
    assert.match(routing, /'\/AssessmentQuestions': \['admin', 'teacher', 'tutor'\]/);
    assert.match(routing, /'\/AssessmentExams': \['admin', 'teacher', 'tutor'\]/);
    assert.match(routing, /'\/Chats': \['admin', 'teacher', 'tutor', 'student', 'tutor_student'\]/);
    assert.match(routing, /'\/MaterialsHub': \['admin', 'teacher', 'tutor'\]/);
    assert.match(routing, /'\/HomeworkList': \['admin', 'teacher', 'tutor'\]/);
    assert.match(routing, /'\/UserManagement': \['admin'\]/);
    assert.match(routing, /'\/AdminPanel': \['admin'\]/);
    assert.match(routing, /'\/TutorStats': \['admin', 'tutor'\]/);
    assert.match(routing, /'\/TeacherAssessment': \['admin', 'teacher'\]/);
    assert.match(routing, /'\/HskAcademy': \['admin', 'teacher', 'student'\]/);
    assert.match(routing, /'\/ExamContent': \['admin', 'teacher'\]/);
    assert.doesNotMatch(routing, /AssessmentExamBlocks/);
    assert.doesNotMatch(routing, /AssessmentBanks/);
    // Tutors must not open school certificates (API also forbids school students).
    assert.match(
      routing,
      /prefix: '\/certificate\/', roles: \['admin', 'teacher', 'student'\]/,
    );
  });

  it('allowlists StudentExamFeedback for student (and staff) without opening admin exam pages', () => {
    assert.match(
      routing,
      /'\/StudentExamFeedback': \['admin', 'teacher', 'tutor', 'student'\]/,
    );
    assert.match(routing, /'\/StudentExams': \['student'\]/);
    assert.match(routing, /'\/AssessmentExams': \['admin', 'teacher', 'tutor'\]/);
    assert.match(app, /path="\/StudentExamFeedback"[\s\S]*PathAccessGuard/);
    assert.doesNotMatch(
      app,
      /path="\/StudentExamFeedback"[\s\S]{0,120}StudentRoute/,
    );
    const adminExamLine = routing
      .split('\n')
      .find((l) => l.includes("'/AssessmentExams'"));
    assert.ok(adminExamLine);
    assert.doesNotMatch(adminExamLine, /'student'/);
  });

  it('denies tutors and tutor_students on HSK Academy and Exam Content', () => {
    for (const path of [
      'HskAcademy',
      'HskAcademyPractice',
      'HskAcademyMock',
      'HskAcademyPreparation',
      'HskAcademyTake',
      'HskAcademyResult',
      'ExamContent',
      'ExamContentBank',
      'ExamContentMedia',
      'ExamContentExams',
      'ExamContentOps',
    ]) {
      const line = routing.split('\n').find((l) => l.includes(`'/${path}'`));
      assert.ok(line, `missing allowlist for /${path}`);
      assert.doesNotMatch(line, /'tutor'/);
      assert.doesNotMatch(line, /tutor_student/);
    }
  });

  it('denies students and tutor_students on authoring / admin / salary surfaces', () => {
    for (const path of [
      'AssessmentQuestions',
      'AssessmentExams',
      'MaterialsHub',
      'HomeworkList',
      'UserManagement',
      'AdminPanel',
      'TutorStats',
    ]) {
      const line = routing.split('\n').find((l) => l.includes(`'/${path}'`));
      assert.ok(line, `missing allowlist for /${path}`);
      assert.doesNotMatch(line, /'student'/);
      assert.doesNotMatch(line, /tutor_student/);
    }
  });

  it('wires App routes with RoleRouteGuard and role wrappers', () => {
    assert.match(app, /RoleRouteGuard/);
    assert.match(app, /AssessmentQuestions[\s\S]*TeacherRoute allowTutor/);
    assert.match(app, /UserManagement[\s\S]*AdminRoute/);
    assert.match(app, /AdminPanel[\s\S]*AdminRoute/);
    assert.match(app, /PathAccessGuard/);
    assert.match(app, /path="\/Chats"[\s\S]*PathAccessGuard/);
    assert.doesNotMatch(app, /AssessmentBanks/);
  });

  it('keeps AssessmentQuestions in teacher and tutor menus', () => {
    assert.match(layout, /Мои вопросы/);
    assert.match(layout, /AssessmentQuestions/);
    assert.doesNotMatch(layout, /Банки вопросов/);
  });

  it('backend questions controller enforces roles without banks', () => {
    const questions = readFileSync(
      join(root, 'apps/api/src/modules/assessment/controllers/assessment-questions.controller.ts'),
      'utf8',
    );
    assert.match(questions, /@Roles\('admin', 'teacher', 'tutor'\)/);
    assert.match(questions, /RolesGuard/);
    assert.doesNotMatch(questions, /bank_id/);
    assert.ok(
      !readFileSync(
        join(root, 'apps/api/src/modules/assessment/assessment.module.ts'),
        'utf8',
      ).includes('AssessmentBanksController'),
    );
  });
});
