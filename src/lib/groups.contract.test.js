import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitGroupLessons } from './groupLessons.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '../..');

describe('Groups module contract', () => {
  it('Groups keep read-only schedule tab; no planner; Schedule creates group lessons', () => {
    const layout = readFileSync(join(root, 'src/Layout.jsx'), 'utf8');
    const routing = readFileSync(join(root, 'src/lib/routing.js'), 'utf8');
    const app = readFileSync(join(root, 'src/App.jsx'), 'utf8');
    const page = readFileSync(join(root, 'src/pages/Groups.jsx'), 'utf8');
    const detail = readFileSync(join(root, 'src/pages/GroupDetail.jsx'), 'utf8');
    const lessonModal = readFileSync(
      join(root, 'src/components/schedule/LessonModal.jsx'),
      'utf8',
    );

    assert.match(layout, /page:\s*["']Groups["']/);
    assert.match(routing, /'\/Groups':\s*\['admin',\s*'teacher'\]/);
    assert.match(app, /TeacherRoute>[\s\S]*Groups/);
    assert.match(page, /@\/design-system/);
    assert.match(page, /Название группы/);

    assert.match(detail, /Ученики группы/);
    assert.match(detail, /\{ id: ['\"]schedule['\"]/);
    assert.match(detail, /group-schedule-readonly|Предстоящие занятия/);
    assert.match(detail, /История занятий/);
    assert.match(detail, /Открыть в расписании/);
    assert.match(detail, /splitGroupLessons|workspace\?\.lessons/);
    assert.doesNotMatch(detail, /lessonSeries\.create|seriesForm/);
    assert.doesNotMatch(detail, /Создать расписание|Создать уроки по расписанию/);

    assert.match(lessonModal, /value=\"group\"/);
    assert.match(lessonModal, /selectGroup|group_id/);
  });

  it('splitGroupLessons sorts upcoming ASC and history DESC by start time', () => {
    const now = Date.parse('2026-10-10T12:00:00');
    const { upcoming, history } = splitGroupLessons(
      [
        { id: '1', date: '2026-10-12', start_time: '18:00' },
        { id: '2', date: '2026-10-08', start_time: '18:00' },
        { id: '3', date: '2026-10-15', start_time: '10:00' },
        { id: '4', date: '2026-10-05', start_time: '18:00' },
      ],
      now,
    );
    assert.deepEqual(
      upcoming.map((l) => l.id),
      ['1', '3'],
    );
    assert.deepEqual(
      history.map((l) => l.id),
      ['2', '4'],
    );
  });
});
