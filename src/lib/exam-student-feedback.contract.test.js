import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  buildExamItemReview,
  formatStudentExamAnswer,
} from './exam-item-review.js';
import {
  isExamResultReviewed,
  resultStatusLabel,
} from './assessment-ui.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

describe('exam student feedback', () => {
  it('maps API item to LearnerItemReview props', () => {
    const review = buildExamItemReview({
      review_comment: '  Нужен другой порядок слов.  ',
      score: 0.5,
      points: 2,
      is_correct: false,
      expected_answer: '正确顺序',
    });
    assert.equal(review.comment, 'Нужен другой порядок слов.');
    assert.equal(review.earnedPoints, 0.5);
    assert.equal(review.maxPoints, 2);
    assert.equal(review.isCorrect, false);
    assert.equal(review.expectedAnswer, '正确顺序');
  });

  it('formats student answer from text or options', () => {
    assert.equal(
      formatStudentExamAnswer({ student_text_answer: '你好' }),
      '你好',
    );
    assert.equal(
      formatStudentExamAnswer({
        selected_option_texts: ['A', 'C'],
      }),
      'A, C',
    );
    assert.equal(formatStudentExamAnswer({ has_audio: true }), 'Аудиоответ');
  });

  it('student may open /StudentExamFeedback; admin exam pages stay forbidden', () => {
    const routing = readFileSync(join(root, 'lib/routing.js'), 'utf8');
    assert.match(
      routing,
      /'\/StudentExamFeedback': \['admin', 'teacher', 'tutor', 'student'\]/,
    );
    const feedbackLine = routing
      .split('\n')
      .find((l) => l.includes("'/StudentExamFeedback'"));
    assert.ok(feedbackLine);
    assert.match(feedbackLine, /'student'/);
    assert.match(feedbackLine, /'admin'/);
    assert.match(feedbackLine, /'teacher'/);
    assert.match(feedbackLine, /'tutor'/);
    const adminExamLine = routing
      .split('\n')
      .find((l) => l.includes("'/AssessmentExams'"));
    assert.ok(adminExamLine);
    assert.doesNotMatch(adminExamLine, /'student'/);
  });

  it('only finalized results unlock feedback CTA', () => {
    assert.equal(resultStatusLabel({ status: 'pending_review' }), 'pending_review');
    assert.equal(isExamResultReviewed({ status: 'pending_review' }), false);
    assert.equal(isExamResultReviewed({ status: 'passed', passed: true }), true);
    assert.equal(isExamResultReviewed({ status: 'failed', passed: false }), true);
  });

  it('wires feedback API, route, and per-question UI', () => {
    const api = readFileSync(join(root, 'api/assessment.api.js'), 'utf8');
    const app = readFileSync(join(root, 'App.jsx'), 'utf8');
    const page = readFileSync(join(root, 'pages/StudentExamFeedback.jsx'), 'utf8');
    const studentExams = readFileSync(join(root, 'pages/StudentExams.jsx'), 'utf8');
    const card = readFileSync(
      join(root, 'components/assessment/ExamAssignmentCard.jsx'),
      'utf8',
    );
    const completion = readFileSync(
      join(root, 'components/assessment/ExamCompletionScreen.jsx'),
      'utf8',
    );
    const controller = readFileSync(
      join(root, '../apps/api/src/modules/assessment/controllers/assessment-results.controller.ts'),
      'utf8',
    );
    const service = readFileSync(
      join(root, '../apps/api/src/modules/assessment/services/result.service.ts'),
      'utf8',
    );
    const access = readFileSync(
      join(root, '../apps/api/src/common/access/assessment-access.service.ts'),
      'utf8',
    );
    assert.match(api, /getResultFeedback/);
    assert.match(api, /\/feedback/);
    assert.match(app, /StudentExamFeedback/);
    assert.match(app, /PathAccessGuard/);
    assert.match(page, /student-exam-feedback/);
    assert.match(page, /LearnerItemReview/);
    assert.match(page, /Комментарий|buildExamItemReview/);
    assert.match(studentExams, /StudentExamFeedback/);
    assert.match(studentExams, /isExamResultReviewed/);
    assert.match(card, /Посмотреть разбор/);
    assert.match(card, /Ожидает проверки/);
    assert.match(card, /exam-view-feedback-button/);
    assert.match(completion, /Посмотреть разбор/);
    assert.match(completion, /Экзамен отправлен на проверку/);
    assert.match(completion, /isExamResultReviewed/);
    assert.match(controller, /getStudentFeedback|:resultId\/feedback/);
    assert.match(controller, /@Roles\('admin', 'teacher', 'tutor', 'student'\)/);
    assert.match(service, /getStudentFeedback/);
    assert.match(service, /assertCanReadResult/);
    assert.match(service, /review_comment:/);
    assert.match(service, /expected_answer:/);
    assert.match(access, /assertCanReadResult/);
    assert.match(access, /cannot access foreign Result/);
    const dtoBlock = service.slice(
      service.indexOf('StudentFeedbackItemDto'),
      service.indexOf('StudentFeedbackBundleDto'),
    );
    assert.doesNotMatch(dtoBlock, /reviewedByUserId|reviewed_by/);
  });
});
