import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const read = (rel) => readFileSync(join(root, rel), 'utf8');

describe('admin exam registry', () => {
  it('registers admin-only routes, API and pages for registry + attempt detail', () => {
    const routing = read('src/lib/routing.js');
    const app = read('src/App.jsx');
    const hub = read('src/pages/AdminAssessment.jsx');
    const api = read('src/api/assessment.api.js');
    const controller = read(
      'apps/api/src/modules/assessment/controllers/assessment-admin.controller.ts',
    );
    const registry = read('src/pages/AdminExamRegistry.jsx');
    const detail = read('src/pages/AdminExamAttemptDetail.jsx');

    assert.match(routing, /'\/AdminExamRegistry': \['admin'\]/);
    assert.match(routing, /'\/AdminExamAttemptDetail': \['admin'\]/);
    assert.doesNotMatch(
      routing,
      /'\/AdminExamRegistry': \[[^\]]*teacher/,
    );

    assert.match(app, /AdminExamRegistry/);
    assert.match(app, /AdminExamAttemptDetail/);
    assert.match(app, /AdminRoute/);

    assert.match(hub, /AdminExamRegistry/);
    assert.match(api, /adminListExams/);
    assert.match(api, /adminGetAttemptDetail/);
    assert.match(api, /\/assessment\/admin\/exams/);
    assert.match(api, /\/assessment\/admin\/attempts/);

    assert.match(controller, /@Roles\('admin'\)/);
    assert.match(controller, /@Controller\('assessment\/admin'\)/);
    assert.match(controller, /listExams/);
    assert.match(controller, /getAttemptDetail/);
    assert.match(controller, /score-history/);

    assert.match(registry, /admin-exam-registry/);
    assert.match(detail, /admin-exam-attempt-detail/);
    assert.match(detail, /adjustResultFinalScore/);
    assert.match(detail, /не зафиксирован/);
    assert.match(detail, /admin-score-history|История корректировок/);
  });
});
