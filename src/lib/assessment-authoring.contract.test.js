import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Assessment authoring access', () => {
  it('opens shared assessment authoring routes for teacher and tutor without banks or exam blocks UI', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
    assert.match(app, /AssessmentQuestions/);
    assert.match(app, /AssessmentExams/);
    assert.match(app, /TeacherRoute allowTutor/);
    assert.doesNotMatch(app, /AssessmentExamBlocks/);
    assert.doesNotMatch(routing, /AssessmentExamBlocks/);
    assert.match(routing, /AssessmentExams/);
    assert.doesNotMatch(app, /AssessmentBanks/);
    assert.doesNotMatch(routing, /AssessmentBanks/);
    assert.doesNotMatch(app, /AssessmentExamTemplates/);
    assert.doesNotMatch(app, /AssessmentBlueprints/);
  });

  it('shows questions / exams / homework in teacher and tutor navigation without banks or exam blocks', () => {
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    assert.doesNotMatch(layout, /Банки вопросов/);
    assert.doesNotMatch(layout, /AssessmentBanks/);
    assert.doesNotMatch(layout, /Мои блоки/);
    assert.doesNotMatch(layout, /AssessmentExamBlocks/);
    assert.match(layout, /Мои вопросы/);
    assert.match(layout, /Мои экзамены/);
    assert.match(layout, /Домашние задания/);
  });

  it('keeps import and export actions in the shared questions UI', () => {
    const questions = readFileSync(join(root, 'src/pages/AssessmentQuestions.jsx'), 'utf8');
    assert.match(questions, /Экспорт/);
    assert.match(questions, /Импорт/);
    assert.match(questions, /createQuestion/);
    assert.match(questions, /listContentTasks|ContentTaskFormDialog/);
    assert.doesNotMatch(questions, /bank_id/);
    assert.doesNotMatch(questions, /AssessmentBanks/);
  });
});
