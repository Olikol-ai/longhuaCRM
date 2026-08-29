import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  filterExamResults,
  filterHomeworkAssignments,
  isExamResultCompleted,
  isExamResultPending,
  isHomeworkCompleted,
  isHomeworkNeedsReview,
} from './teacher-work-history.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('teacher work history (homework + exams)', () => {
  it('classifies homework review vs completed history from API statuses', () => {
    assert.equal(isHomeworkNeedsReview({ status: 'submitted' }), true);
    assert.equal(isHomeworkNeedsReview({ needs_manual_review: true }), true);
    assert.equal(isHomeworkCompleted({ status: 'checked' }), true);
    assert.equal(isHomeworkCompleted({ status: 'reviewed' }), true);
    assert.equal(isHomeworkCompleted({ status: 'submitted' }), false);

    const rows = [
      { id: '1', status: 'submitted' },
      { id: '2', status: 'checked', result_percent: 90 },
      { id: '3', status: 'assigned' },
    ];
    assert.deepEqual(
      filterHomeworkAssignments(rows, 'review').map((r) => r.id),
      ['1'],
    );
    assert.deepEqual(
      filterHomeworkAssignments(rows, 'history').map((r) => r.id),
      ['2'],
    );
    assert.equal(filterHomeworkAssignments(rows, 'all').length, 3);
  });

  it('classifies exam pending vs completed results', () => {
    assert.equal(isExamResultPending({ status: 'pending_review' }), true);
    assert.equal(isExamResultCompleted({ status: 'passed', passed: true }), true);
    assert.equal(isExamResultCompleted({ status: 'failed', passed: false }), true);
    assert.equal(isExamResultCompleted({ status: 'pending_review' }), false);

    const rows = [
      { id: 'a', status: 'pending_review' },
      { id: 'b', status: 'passed', passed: true },
      { id: 'c', status: 'failed', passed: false },
    ];
    assert.deepEqual(filterExamResults(rows, 'pending').map((r) => r.id), ['a']);
    assert.deepEqual(filterExamResults(rows, 'completed').map((r) => r.id), ['b', 'c']);
  });

  it('HomeworkList keeps permanent history tabs and opens HomeworkResults', () => {
    const list = read('src/pages/HomeworkList.jsx');
    assert.match(list, /На проверке/);
    assert.match(list, /Выполненные/);
    assert.match(list, /filterHomeworkAssignments/);
    assert.match(list, /HomeworkResults/);
    assert.match(list, /assigned_at/);
    assert.match(list, /checked_at/);
    assert.match(list, /student_feedback|owner_comment/);
    assert.doesNotMatch(list, /localStorage/);
  });

  it('TeacherAssessment exposes permanent completed exam history with reopen', () => {
    const hub = read('src/pages/TeacherAssessment.jsx');
    const results = read('src/pages/TeacherAssessmentResults.jsx');
    const detail = read('src/pages/TeacherAssessmentReviewDetail.jsx');
    const hook = read('src/hooks/useTeacherAssessment.js');
    assert.match(hub, /teacher-exam-work-tabs/);
    assert.match(hub, /На проверке/);
    assert.match(hub, /Завершённые/);
    assert.match(hub, /Открыть разбор/);
    assert.match(hub, /TeacherAssessmentReviewDetail/);
    assert.match(results, /onRowClick/);
    assert.match(results, /TeacherAssessmentReviewDetail/);
    assert.match(results, /filterExamResults/);
    assert.match(detail, /isFinalized/);
    assert.match(hook, /listResults/);
    assert.doesNotMatch(hub, /resultStatus === 'final'/);
    assert.doesNotMatch(hub, /localStorage/);
  });

  it('reuses existing ACL endpoints; students stay off teacher review write paths', () => {
    const hwController = read(
      'apps/api/src/modules/homework/controllers/homework.controller.ts',
    );
    const resultsController = read(
      'apps/api/src/modules/assessment/controllers/assessment-results.controller.ts',
    );
    const access = read(
      'apps/api/src/common/access/assessment-access.service.ts',
    );
    const hwService = read(
      'apps/api/src/modules/homework/services/homework.service.ts',
    );
    const routing = read('src/lib/routing.js');

    assert.match(hwController, /listAssignmentsForTeacher|assignments/);
    assert.match(hwService, /listAssignmentsForTeacher/);
    assert.match(hwService, /assertCanViewHomework|assertManagerOrAdmin/);
    assert.match(hwService, /student_feedback:/);
    assert.match(resultsController, /getReview\(/);
    assert.match(
      resultsController,
      /@Get\(':resultId\/review'\)[\s\S]*?@Roles\('admin', 'teacher', 'tutor'\)[\s\S]*?getReview\(/,
    );
    assert.match(
      resultsController,
      /@Get\(':resultId\/feedback'\)[\s\S]*?@Roles\('admin', 'teacher', 'tutor', 'student'\)[\s\S]*?getStudentFeedback\(/,
    );    assert.match(access, /assertCanReadResult/);
    assert.match(access, /cannot access foreign Result/);
    assert.match(routing, /'\/TeacherAssessment': \['admin', 'teacher'\]/);
    assert.match(routing, /'\/HomeworkResults': \['admin', 'teacher', 'tutor'\]/);
    assert.doesNotMatch(
      routing,
      /'\/TeacherAssessment': \[[^\]]*student/,
    );
    assert.doesNotMatch(
      routing,
      /'\/HomeworkResults': \[[^\]]*student/,
    );
  });
});
