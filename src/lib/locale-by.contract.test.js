import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ROLE_LABEL,
  LESSON_STATUS_LABEL,
  ENTITY_STATUS_LABEL,
  localizeRole,
  localizeLessonStatus,
  localizeEntityStatus,
} from './locale-by.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcRoot = join(__dirname, '..');

describe('locale-by dictionaries', () => {
  it('maps roles to Russian labels', () => {
    assert.equal(localizeRole('admin'), 'Администратор');
    assert.equal(localizeRole('teacher'), 'Преподаватель');
    assert.equal(localizeRole('tutor'), 'Репетитор');
    assert.equal(localizeRole('student'), 'Ученик');
    assert.equal(localizeRole('tutor_student'), 'Ученик репетитора');
    assert.equal(ROLE_LABEL.pending, 'Ожидает роли');
  });

  it('maps lesson and entity statuses to Russian', () => {
    assert.equal(localizeLessonStatus('planned'), 'Запланировано');
    assert.equal(localizeLessonStatus('completed'), 'Проведено');
    assert.equal(localizeLessonStatus('cancelled'), 'Отменено');
    assert.equal(localizeLessonStatus('rescheduled'), 'Перенесено');
    assert.equal(localizeEntityStatus('active'), 'Активен');
    assert.equal(localizeEntityStatus('inactive'), 'Неактивен');
    assert.equal(localizeEntityStatus('pending'), 'Ожидает');
    assert.ok(LESSON_STATUS_LABEL.missed);
    assert.ok(ENTITY_STATUS_LABEL.paused);
  });
});

describe('Belarus UI localization contracts', () => {
  it('admin menu items are Russian', () => {
    const layout = readFileSync(join(srcRoot, 'Layout.jsx'), 'utf8');
    for (const label of [
      'Главная',
      'Расписание',
      'Панель управления',
      'Пользователи',
      'Группы',
      'Сертификаты',
      'Платежи',
      'Материалы',
      'Экзамены',
      'Настройки',
    ]) {
      assert.match(layout, new RegExp(label));
    }
    assert.doesNotMatch(layout, /name:\s*["']Dashboard["']/);
    assert.doesNotMatch(layout, /name:\s*["']Settings["']/);
    assert.doesNotMatch(layout, /name:\s*["']Users["']/);
    assert.doesNotMatch(layout, /name:\s*["']Groups["']/);
  });

  it('user management role labels are Russian', () => {
    const constants = readFileSync(
      join(srcRoot, 'pages', 'userManagement.constants.js'),
      'utf8',
    );
    assert.match(constants, /label:\s*'Администратор'/);
    assert.match(constants, /label:\s*'Преподаватель'/);
    assert.match(constants, /label:\s*'Репетитор'/);
    assert.match(constants, /label:\s*'Ученик'/);
    assert.match(constants, /label:\s*'Ученик репетитора'/);
  });

  it('does not expose common English UI chrome in shared primitives', () => {
    const dialog = readFileSync(join(srcRoot, 'components', 'ui', 'dialog.jsx'), 'utf8');
    const pagination = readFileSync(
      join(srcRoot, 'components', 'ui', 'pagination.jsx'),
      'utf8',
    );
    assert.match(dialog, /Закрыть/);
    assert.doesNotMatch(dialog, />Close</);
    assert.match(pagination, /Назад/);
    assert.match(pagination, /Далее/);
    assert.doesNotMatch(pagination, />Previous</);
    assert.doesNotMatch(pagination, />Next</);
  });

  it('teacher form uses BYN not dollar currency label', () => {
    const form = readFileSync(
      join(srcRoot, 'components', 'teachers', 'TeacherFormDialog.jsx'),
      'utf8',
    );
    assert.match(form, /BYN/);
    assert.doesNotMatch(form, /Ставка в час \(\$\)/);
  });
});
