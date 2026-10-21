import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('exam final score adjust', () => {
  it('exposes assigner-only final-score API and keeps student on canonical score', () => {
    const controller = read(
      'apps/api/src/modules/assessment/controllers/assessment-results.controller.ts',
    );
    const api = read('src/api/assessment.api.js');
    const page = read('src/pages/TeacherAssessmentReviewDetail.jsx');
    const student = read('src/pages/StudentExamFeedback.jsx');
    const entity = read(
      'apps/api/src/modules/assessment/entities/assessment-result.entity.ts',
    );
    const migration = read(
      'apps/api/src/database/migrations/1747400000000-AssessmentResultFinalScore.ts',
    );

    assert.match(controller, /@Patch\(':resultId\/final-score'\)/);
    assert.match(controller, /adjustFinalScore/);
    assert.match(api, /adjustResultFinalScore/);
    assert.match(api, /\/final-score/);
    assert.match(page, /teacher-adjust-final-score/);
    assert.match(page, /adjustResultFinalScore/);
    assert.doesNotMatch(
      page,
      /Изменить балл вопроса|editQuestionScore|per-question score edit/i,
    );
    assert.match(student, /result\.score/);
    assert.doesNotMatch(student, /auto_score/);
    assert.match(entity, /autoScore/);
    assert.match(entity, /scoreSource/);
    assert.match(migration, /auto_score/);
    assert.match(migration, /score_source/);
    assert.match(migration, /Does NOT backfill auto_score/);
  });
});
