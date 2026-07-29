import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Assessment authoring access', () => {
  it('opens shared assessment authoring routes for teacher and tutor', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
    assert.match(app, /AssessmentBanks/);
    assert.match(app, /TeacherRoute allowTutor/);
    assert.match(routing, /AssessmentBanks/);
    assert.match(routing, /AssessmentExams/);
  });

  it('shows assessment authoring entries in teacher and tutor navigation', () => {
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    assert.match(layout, /Банк вопросов/);
    assert.match(layout, /Конструктор экзаменов/);
  });

  it('keeps import and export actions in the shared questions UI', () => {
    const questions = readFileSync(join(root, 'src/pages/AssessmentQuestions.jsx'), 'utf8');
    assert.match(questions, /Экспорт/);
    assert.match(questions, /Импорт/);
    assert.match(questions, /createQuestion/);
  });
});
