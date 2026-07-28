import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Homework module architecture', () => {
  it('uses separate homework entities and shared scoring, not Exam entity', () => {
    const service = readFileSync(
      join(root, 'apps/api/src/modules/homework/services/homework.service.ts'),
      'utf8',
    );
    assert.match(service, /AssessmentScoringService/);
    assert.match(service, /scoreFromData/);
    assert.doesNotMatch(service, /AssessmentExamEntity/);
    assert.doesNotMatch(service, /from '\.\.\/assessment\/entities\/assessment-exam/);
  });

  it('exposes teacher and student homework UI without exam terminology', () => {
    const viewer = readFileSync(join(root, 'src/pages/HomeworkViewer.jsx'), 'utf8');
    const list = readFileSync(join(root, 'src/pages/HomeworkList.jsx'), 'utf8');
    assert.match(viewer, /Домашние задания/);
    assert.match(list, /Домашние задания/);
    assert.doesNotMatch(viewer, /[Ээ]кзамен/);
    assert.doesNotMatch(list, /[Ээ]кзамен/);
  });

  it('registers homework routes and menu entries', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    assert.match(app, /HomeworkList/);
    assert.match(app, /HomeworkViewer/);
    assert.match(layout, /HomeworkList/);
    assert.match(layout, /HomeworkViewer/);
  });

  it('AssessmentScoringService exposes shared scoreFromData', () => {
    const scoring = readFileSync(
      join(root, 'apps/api/src/modules/assessment/services/assessment-scoring.service.ts'),
      'utf8',
    );
    assert.match(scoring, /scoreFromData\(/);
  });
});
