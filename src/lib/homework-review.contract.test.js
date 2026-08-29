import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('Homework review / grading UX', () => {
  it('persists grading_mode and manual_percentage in DB, API and UI', () => {
    const entity = read(
      'apps/api/src/modules/homework/entities/homework-result.entity.ts',
    );
    const migration = read(
      'apps/api/src/database/migrations/1746500000000-HomeworkGradingMode.ts',
    );
    const dto = read('apps/api/src/modules/homework/dto/homework.dto.ts');
    const service = read(
      'apps/api/src/modules/homework/services/homework.service.ts',
    );
    const results = read('src/pages/HomeworkResults.jsx');
    const api = read('src/api/homework.api.js');
    assert.match(entity, /grading_mode/);
    assert.match(entity, /manual_percentage/);
    assert.match(entity, /show_correct_answers/);
    assert.match(migration, /grading_mode/);
    assert.match(migration, /manual_percentage/);
    assert.match(dto, /grading_mode/);
    assert.match(dto, /manual_percentage/);
    assert.match(dto, /student_feedback/);
    assert.match(service, /gradingMode/);
    assert.match(service, /resolveHomeworkPercent/);
    assert.match(results, /grading_mode/);
    assert.match(results, /manual_percentage/);
    assert.match(results, /homework-grading-mode/);
    assert.match(api, /finalizeReview\(assignmentId, body\)/);
    assert.doesNotMatch(results, /localStorage/);
  });

  it('treats missing grading_mode as auto for old submissions', () => {
    const util = read('apps/api/src/modules/homework/homework-grading.util.ts');
    const service = read(
      'apps/api/src/modules/homework/services/homework.service.ts',
    );
    assert.match(util, /value === 'manual' \? 'manual' : 'auto'/);
    assert.match(service, /normalizeHomeworkGradingMode\(result\.gradingMode\)/);
  });

  it('does not recompute manual percent from item scores', () => {
    const util = read('apps/api/src/modules/homework/homework-grading.util.ts');
    const service = read(
      'apps/api/src/modules/homework/services/homework.service.ts',
    );
    assert.match(util, /never recomputed from item scores/);
    assert.match(service, /gradingMode: 'manual'/);
    assert.match(service, /manualPercentage: result\.manualPercentage/);
  });

  it('keeps difficulty out of homework percent scoring', () => {
    const scoring = read(
      'apps/api/src/modules/assessment/services/assessment-scoring.service.ts',
    );
    const item = read(
      'apps/api/src/modules/homework/entities/homework-item.entity.ts',
    );
    const docs = read('docs/architecture/homework-grading.md');
    assert.doesNotMatch(scoring, /difficulty/);
    assert.match(item, /Never used as a homework grading multiplier/);
    assert.match(docs, /not a multiplier for homework percent/i);
  });

  it('shows teacher comments to the student after review', () => {
    const viewer = read('src/pages/HomeworkViewer.jsx');
    const card = read('src/components/assessment/QuestionCard.jsx');
    const feedback = read('src/components/assessment/LearnerItemReview.jsx');
    const service = read(
      'apps/api/src/modules/homework/services/homework.service.ts',
    );
    assert.match(viewer, /homework-student-feedback/);
    assert.match(viewer, /student_feedback/);
    assert.match(viewer, /buildHomeworkItemReviews/);
    assert.match(viewer, /itemReviews/);
    assert.doesNotMatch(viewer, /homework-student-item-feedback/);
    assert.match(card, /LearnerItemReview/);
    assert.match(feedback, /homework-item-teacher-comment/);
    assert.match(feedback, /homework-item-score/);
    assert.match(service, /showStudentReview/);
    assert.match(service, /student_feedback:/);
  });

  it('renders question → student answer → score → teacher comment in one card', () => {
    const card = read('src/components/assessment/QuestionCard.jsx');
    const feedback = read('src/components/assessment/LearnerItemReview.jsx');
    const speakingIdx = card.indexOf('SpeakingAnswerPanel');
    const reviewIdx = card.indexOf('<LearnerItemReview');
    assert.ok(speakingIdx >= 0 && reviewIdx > speakingIdx);
    const scoreIdx = feedback.indexOf('homework-item-score');
    const commentIdx = feedback.indexOf('homework-item-teacher-comment');
    assert.ok(scoreIdx >= 0 && commentIdx > scoreIdx);
    assert.match(feedback, /whitespace-pre-wrap/);
    assert.match(feedback, /overflow-wrap:anywhere/);
    assert.doesNotMatch(feedback, /truncate/);
  });

  it('does not show reviewer-only expected answers to the student by default', () => {
    const viewer = read('src/pages/HomeworkViewer.jsx');
    const service = read(
      'apps/api/src/modules/homework/services/homework.service.ts',
    );
    const results = read('src/pages/HomeworkResults.jsx');
    const form = read('src/components/assessment/QuestionFormDialog.jsx');
    assert.match(service, /showExpectedAnswers/);
    assert.match(service, /showCorrectAnswers/);
    assert.match(results, /homework-show-correct/);
    assert.match(results, /Эталонный ответ для проверяющего/);
    assert.match(form, /Эталонный ответ для проверяющего/);
    assert.doesNotMatch(viewer, /Эталонный ответ для проверяющего/);
    const feedback = read('src/components/assessment/LearnerItemReview.jsx');
    assert.match(feedback, /homework-student-expected-answer/);
    assert.match(feedback, /expectedAnswer/);
  });

  it('uses a vertical accordion review UI without a right-side review column', () => {
    const results = read('src/pages/HomeworkResults.jsx');
    assert.match(results, /homework-review-accordion/);
    assert.match(results, /aria-expanded/);
    assert.match(results, /flex flex-col gap-4/);
    assert.doesNotMatch(results, /md:grid-cols-2/);
    assert.doesNotMatch(results, /lg:grid-cols-3/);
    assert.match(results, /overflow-x-hidden/);
    assert.match(results, /min-h-11/);
  });
});
