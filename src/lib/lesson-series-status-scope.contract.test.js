import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  lessonBelongsToSeries,
  statusChangeToastTitle,
} from './lessonSeriesScope.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('series lesson status scope', () => {
  it('detects series membership from snake/camel fields', () => {
    assert.equal(lessonBelongsToSeries({ recurrence_series_id: 's1' }), true);
    assert.equal(lessonBelongsToSeries({ recurrenceSeriesId: 's1' }), true);
    assert.equal(lessonBelongsToSeries({ is_recurring: true }), true);
    assert.equal(lessonBelongsToSeries({ id: 'x' }), false);
  });

  it('toast titles hide technical applyScope', () => {
    assert.equal(statusChangeToastTitle('cancelled', 'this'), 'Урок отменён');
    assert.equal(
      statusChangeToastTitle('cancelled', 'all'),
      'Занятия серии отменены',
    );
    assert.equal(
      statusChangeToastTitle('cancelled', 'series'),
      'Занятия серии отменены',
    );
  });

  it('wires UI cancel through scope dialog for series lessons', () => {
    const modal = read('src/components/schedule/LessonDetailModal.jsx');
    const dialog = read('src/components/schedule/RecurrenceApplyScopeDialog.jsx');
    const scopeLib = read('src/lib/lessonSeriesScope.js');
    const calendar = read('src/components/schedule/SchoolScheduleCalendar.jsx');
    const recurrence = read(
      'apps/api/src/modules/lessons/lesson-recurrence.service.ts',
    );
    const lessons = read('apps/api/src/modules/lessons/lessons.service.ts');
    const controller = read('apps/api/src/modules/lessons/lessons.controller.ts');

    assert.match(modal, /requestStatusChange\("cancelled"\)/);
    assert.match(modal, /mode=\{scopeDialogMode\}/);
    assert.match(dialog, /mode === "status"/);
    assert.match(dialog, /STATUS_SCOPE_OPTIONS/);
    assert.match(scopeLib, /Все занятия серии/);
    assert.doesNotMatch(dialog, /applyScope=this/);
    assert.match(calendar, /lessonBelongsToSeries\(lesson\)/);
    assert.match(calendar, /mode="status"/);

    assert.match(lessons, /cancelWithScope/);
    assert.match(recurrence, /cancelWithScope/);
    assert.match(recurrence, /assertCanWriteLesson/);
    assert.match(recurrence, /buildSeriesFanoutPatch|SERIES_FANOUT_KEYS/);
    assert.match(controller, /applyScope !== undefined/);
    assert.doesNotMatch(
      recurrence,
      /Массовое изменение статуса серии поддерживается только для отмены/,
    );
    assert.doesNotMatch(recurrence, /только для админ/);
  });
});
