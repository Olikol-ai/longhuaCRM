import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DELETE_SCOPE_OPTIONS,
  deleteToastTitle,
  isSeriesWideScope,
  lessonBelongsToSeries,
} from './lessonSeriesScope.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('series lesson delete scope', () => {
  it('delete options stay human-readable', () => {
    assert.equal(DELETE_SCOPE_OPTIONS.length, 2);
    assert.equal(DELETE_SCOPE_OPTIONS[0].value, 'this');
    assert.equal(DELETE_SCOPE_OPTIONS[1].value, 'all');
    assert.match(DELETE_SCOPE_OPTIONS[0].title, /Только это занятие/);
    assert.match(DELETE_SCOPE_OPTIONS[1].title, /Все занятия серии/);
    assert.equal(deleteToastTitle('this'), 'Урок удалён');
    assert.equal(deleteToastTitle('all'), 'Серия занятий удалена');
    assert.equal(deleteToastTitle('series'), 'Серия занятий удалена');
    assert.equal(isSeriesWideScope('all'), true);
    assert.equal(isSeriesWideScope('this'), false);
  });

  it('wires delete scope dialog only for series membership', () => {
    const modal = read('src/components/schedule/LessonDetailModal.jsx');
    const dialog = read('src/components/schedule/RecurrenceApplyScopeDialog.jsx');
    const scopeLib = read('src/lib/lessonSeriesScope.js');
    const api = read('src/api/lessons.api.js');
    const schedule = read('src/pages/Schedule.jsx');
    const teacherSchedule = read('src/pages/TeacherSchedule.jsx');
    const tutorSchedule = read('src/pages/TutorSchedule.jsx');
    const calendar = read('src/components/schedule/SchoolScheduleCalendar.jsx');
    const groupDetail = read('src/pages/GroupDetail.jsx');
    const controller = read('apps/api/src/modules/lessons/lessons.controller.ts');
    const lessons = read('apps/api/src/modules/lessons/lessons.service.ts');

    assert.equal(lessonBelongsToSeries({ recurrence_series_id: 's1' }), true);
    assert.match(modal, /requestDelete/);
    assert.match(modal, /scopeDialogMode === "delete"/);
    assert.match(modal, /executeDelete/);
    assert.match(modal, /confirmDeleteOpen/);
    assert.match(dialog, /mode === "delete"/);
    assert.match(dialog, /DELETE_SCOPE_OPTIONS/);
    assert.match(dialog, /Будут удалены все занятия этой серии/);
    assert.doesNotMatch(dialog, /applyScope/);
    assert.match(scopeLib, /DELETE_SCOPE_OPTIONS/);
    assert.match(api, /apply_scope/);
    assert.match(api, /method: 'DELETE'/);
    assert.match(schedule, /apply_scope: applyScope/);
    assert.match(teacherSchedule, /onDeleteLesson=\{handleDeleteLesson\}/);
    assert.match(tutorSchedule, /handleDeleteLesson/);
    assert.match(calendar, /onDeleteLesson\(id, applyScope\)/);
    assert.match(groupDetail, /apply_scope: applyScope/);
    assert.match(controller, /deleteWithScope/);
    assert.match(controller, /apply_scope/);
    assert.match(controller, /@Roles\('admin', 'teacher', 'tutor'\)/);
    assert.match(lessons, /async deleteWithScope/);
    assert.match(lessons, /assertCanWriteLesson/);
    assert.match(lessons, /status: 'stopped'/);
    assert.doesNotMatch(lessons, /только для админ/);
  });

  it('desktop and tutor schedule share the same lessons.delete API', () => {
    const schedule = read('src/pages/Schedule.jsx');
    const teacher = read('src/pages/TeacherSchedule.jsx');
    const tutor = read('src/pages/TutorSchedule.jsx');
    const api = read('src/api/lessons.api.js');
    assert.match(api, /delete\(id, options = \{\}\)/);
    assert.match(schedule, /api\.lessons\.delete\(id, \{ apply_scope: applyScope \}\)/);
    assert.match(teacher, /api\.lessons\.delete\(id, \{ apply_scope: applyScope \}\)/);
    assert.match(tutor, /api\.lessons\.delete\(id, \{ apply_scope: applyScope \}\)/);
  });
});
