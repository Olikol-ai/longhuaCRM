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
    assert.match(layout, /Проверочные работы/);
  });

  it('admin assessment hub routes to shared questions / homework / exams pages', () => {
    const admin = readFileSync(join(root, 'src/pages/AdminAssessment.jsx'), 'utf8');
    assert.match(admin, /Проверочные работы/);
    assert.match(admin, /AssessmentQuestions/);
    assert.match(admin, /HomeworkList/);
    assert.match(admin, /AssessmentExams/);
    assert.doesNotMatch(admin, /\bLayers\b/);
    assert.doesNotMatch(admin, /useAssessmentDashboard/);
    assert.doesNotMatch(admin, /AssessmentExamBlocks/);
  });

  it('keeps import and export actions in the shared questions UI', () => {
    const questions = readFileSync(join(root, 'src/pages/AssessmentQuestions.jsx'), 'utf8');
    assert.match(questions, /Экспорт/);
    assert.match(questions, /Импорт/);
    assert.match(questions, /createQuestion/);
    assert.match(questions, /ReadingTaskEditor|ListeningTaskEditor/);
    assert.doesNotMatch(questions, /listQuestions\(\{\s*status:\s*'published'[\s\S]*ContentTask/);
    assert.doesNotMatch(questions, /listContentTasks/);
    assert.doesNotMatch(questions, /ContentTaskFormDialog/);
    assert.doesNotMatch(questions, /bank_id/);
    assert.doesNotMatch(questions, /AssessmentBanks/);
  });

  it('Reading/Listening editors create nested questions without bank listQuestions', () => {
    const reading = readFileSync(
      join(root, 'src/components/assessment/ReadingTaskEditor.jsx'),
      'utf8',
    );
    const listening = readFileSync(
      join(root, 'src/components/assessment/ListeningTaskEditor.jsx'),
      'utf8',
    );
    assert.match(reading, /createReadingTask|updateReadingTask/);
    assert.match(listening, /createListeningTask|updateListeningTask/);
    assert.match(reading, /TaskVocabularyEditor/);
    assert.match(listening, /TaskVocabularyEditor/);
    assert.match(reading, /vocabulary/);
    assert.match(listening, /vocabulary/);
    assert.match(listening, /\.mov/);
    assert.match(listening, /аудиодорожк/);
    assert.doesNotMatch(reading, /api\.assessment\.listQuestions/);
    assert.doesNotMatch(listening, /api\.assessment\.listQuestions/);
  });

  it('backend module drops ContentTask and keeps Reading/Listening controllers', () => {
    const mod = readFileSync(
      join(root, 'apps/api/src/modules/assessment/assessment.module.ts'),
      'utf8',
    );
    assert.doesNotMatch(mod, /ContentTasksController/);
    assert.doesNotMatch(mod, /ContentTaskService/);
    assert.match(mod, /ReadingTasksController/);
    assert.match(mod, /ListeningTasksController/);
    const authoring = readFileSync(
      join(root, 'apps/api/src/modules/assessment/services/question-authoring.service.ts'),
      'utf8',
    );
    assert.match(authoring, /AUTHORING_ATOMIC_QUESTION_TYPES/);
  });
});
