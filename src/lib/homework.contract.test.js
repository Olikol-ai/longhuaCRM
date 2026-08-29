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
    assert.doesNotMatch(service, /ExamBlock/);
    assert.doesNotMatch(service, /from '\.\.\/assessment\/entities\/assessment-exam/);
  });

  it('supports mixed homework_tasks from library plus materialize into homework_items', () => {
    const service = readFileSync(
      join(root, 'apps/api/src/modules/homework/services/homework.service.ts'),
      'utf8',
    );
    const dto = readFileSync(
      join(root, 'apps/api/src/modules/homework/dto/homework.dto.ts'),
      'utf8',
    );
    const editor = readFileSync(join(root, 'src/pages/HomeworkEditor.jsx'), 'utf8');
    assert.match(service, /HomeworkTaskEntity|homeworkTasks/);
    assert.match(service, /replaceTasks/);
    assert.match(service, /materializeItemsFromTasks/);
    assert.match(dto, /class HomeworkTaskDto/);
    assert.match(dto, /task_kind/);
    assert.match(editor, /Добавить тест/);
    assert.match(editor, /listQuestions/);
    assert.match(editor, /listReadingTasks/);
    assert.match(editor, /listListeningTasks/);
    assert.doesNotMatch(editor, /listContentTasks/);
    assert.doesNotMatch(editor, /ExamBlock/);
  });

  it('exposes teacher and student homework UI without exam terminology', () => {
    const viewer = readFileSync(join(root, 'src/pages/HomeworkViewer.jsx'), 'utf8');
    const list = readFileSync(join(root, 'src/pages/HomeworkList.jsx'), 'utf8');
    assert.match(viewer, /Домашние задания/);
    assert.match(viewer, /LearnerQuestionBlocks/);
    assert.match(list, /Домашние задания/);
    assert.match(list, /Шаблоны/);
    assert.match(list, /На проверке/);
    assert.match(list, /Выполненные/);
    assert.match(list, /label: 'Все'/);
    assert.doesNotMatch(viewer, /[Ээ]кзамен/);
    assert.doesNotMatch(list, /[Ээ]кзамен/);
  });

  it('groups shared listening audio once for the student homework attempt UI', () => {
    const blocks = readFileSync(
      join(root, 'src/components/assessment/LearnerQuestionBlocks.jsx'),
      'utf8',
    );
    const panel = readFileSync(
      join(root, 'src/components/assessment/ListeningAudioPanel.jsx'),
      'utf8',
    );
    const helper = readFileSync(join(root, 'src/lib/listening-display.js'), 'utf8');
    assert.match(blocks, /listening-question-block/);
    assert.match(blocks, /hideAudioKey/);
    assert.match(panel, /AuthenticatedAudio/);
    assert.match(panel, /Аудиозапись/);
    assert.match(helper, /groupQuestionsForLearnerDisplay/);
    assert.match(helper, /listening-task:/);
  });

  it('adapts teacher homework pages for mobile without separate mobile apps', () => {
    const list = readFileSync(join(root, 'src/pages/HomeworkList.jsx'), 'utf8');
    const editor = readFileSync(join(root, 'src/pages/HomeworkEditor.jsx'), 'utf8');
    const assign = readFileSync(join(root, 'src/pages/HomeworkAssignment.jsx'), 'utf8');
    const results = readFileSync(join(root, 'src/pages/HomeworkResults.jsx'), 'utf8');
    assert.match(list, /md:hidden/);
    assert.match(list, /hidden md:block/);
    assert.match(list, /break-words/);
    assert.match(list, /overflow-x-hidden/);
    assert.match(editor, /min-h-11/);
    assert.match(editor, /w-full sm:w-auto/);
    assert.match(assign, /sm:grid-cols-2/);
    assert.match(assign, /min-h-11/);
    assert.match(results, /homework-review-accordion/);
    assert.match(results, /overflow-x-hidden/);
    assert.match(results, /min-h-11/);
    assert.match(results, /break-words/);
    assert.doesNotMatch(results, /md:grid-cols-2/);
  });

  it('uses assignment lifecycle statuses assigned/started/submitted/checked/expired/cancelled', () => {
    const enums = readFileSync(
      join(root, 'apps/api/src/modules/homework/enums/homework.enums.ts'),
      'utf8',
    );
    assert.match(enums, /Assigned = 'assigned'/);
    assert.match(enums, /Started = 'started'/);
    assert.match(enums, /Submitted = 'submitted'/);
    assert.match(enums, /Checked = 'checked'/);
    assert.match(enums, /Expired = 'expired'/);
    assert.match(enums, /Cancelled = 'cancelled'/);
    assert.doesNotMatch(enums, /InProgress = 'in_progress'/);
    assert.doesNotMatch(enums, /Reviewed = 'reviewed'/);
  });

  it('registers homework routes and menu entries for teacher, tutor and tutor_student', () => {
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    assert.match(app, /HomeworkList/);
    assert.match(app, /HomeworkViewer/);
    assert.match(app, /allowTutor/);
    assert.match(app, /allowTutorStudent/);
    assert.match(layout, /HomeworkList/);
    assert.match(layout, /HomeworkViewer/);
    assert.match(layout, /Домашние задания/);
  });

  it('AssessmentScoringService exposes shared scoreFromData', () => {
    const scoring = readFileSync(
      join(root, 'apps/api/src/modules/assessment/services/assessment-scoring.service.ts'),
      'utf8',
    );
    assert.match(scoring, /scoreFromData\(/);
  });
});
