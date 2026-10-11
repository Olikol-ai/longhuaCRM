import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  DELETE_SCOPE_OPTIONS,
  DELETE_SCOPE_OPTIONS_ONE_OFF,
  deleteToastTitle,
  formatLessonDeleteDate,
  futureDeleteWarningText,
  isFutureDeleteScope,
  isSeriesWideScope,
  lessonBelongsToSeries,
  thisDeleteWarningText,
} from './lessonSeriesScope.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('series lesson delete scope', () => {
  it('delete options cover this / future / series', () => {
    assert.equal(DELETE_SCOPE_OPTIONS.length, 3);
    assert.equal(DELETE_SCOPE_OPTIONS[0].value, 'this');
    assert.equal(DELETE_SCOPE_OPTIONS[1].value, 'future');
    assert.equal(DELETE_SCOPE_OPTIONS[2].value, 'series');
    assert.equal(DELETE_SCOPE_OPTIONS_ONE_OFF.length, 2);
    assert.match(DELETE_SCOPE_OPTIONS[1].title, /Это и все последующие/);
    assert.match(DELETE_SCOPE_OPTIONS[2].title, /Удалить всю серию/);
    assert.equal(deleteToastTitle('this'), 'Урок удалён');
    assert.equal(deleteToastTitle('future', 12), 'Удалено занятий: 12');
    assert.equal(deleteToastTitle('series', 5), 'Удалено занятий: 5');
    assert.equal(isSeriesWideScope('series'), true);
    assert.equal(isFutureDeleteScope('future'), true);
    assert.equal(formatLessonDeleteDate('2026-09-15'), '15.09.2026');
    assert.match(
      thisDeleteWarningText({ date: '2026-09-15', start_time: '19:00' }),
      /Удалить занятие 15\.09\.2026 19:00/,
    );
    assert.match(
      futureDeleteWarningText({ count: 12, fromDate: '2026-09-15' }),
      /Будет удалено 12 занятий этой серии, начиная с 15\.09\.2026/,
    );
    assert.match(
      futureDeleteWarningText({ count: 8, from_date: '2026-10-01' }, 'series'),
      /Будут удалены все будущие занятия этой серии \(8\)/,
    );
  });

  it('wires delete scope dialog + future/series API stop path', () => {
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
    const recurrence = read('apps/api/src/modules/lessons/lesson-recurrence.service.ts');

    assert.equal(lessonBelongsToSeries({ recurrence_series_id: 's1' }), true);
    assert.match(modal, /requestDelete/);
    assert.match(modal, /previewFutureDelete/);
    assert.match(modal, /previewSeriesDelete/);
    assert.match(modal, /inSeries=\{wasInSeries\}/);
    assert.match(dialog, /DELETE_SCOPE_OPTIONS/);
    assert.match(dialog, /DELETE_SCOPE_OPTIONS_ONE_OFF/);
    assert.match(dialog, /delete-scope-warning/);
    assert.match(scopeLib, /value: "series"/);
    assert.match(api, /\/future/);
    assert.match(api, /\/series/);
    assert.match(api, /previewSeriesDelete/);
    assert.match(schedule, /apply_scope: applyScope/);
    assert.match(teacherSchedule, /onDeleteLesson=\{handleDeleteLesson\}/);
    assert.match(tutorSchedule, /handleDeleteLesson/);
    assert.match(calendar, /onDeleteLesson\(id, applyScope\)/);
    assert.match(groupDetail, /apply_scope: applyScope/);
    assert.match(controller, /deleteStudentFutureFrom/);
    assert.match(controller, /deleteSeriesPlannedFrom/);
    assert.match(controller, /@Delete\(':id\/future'\)/);
    assert.match(controller, /@Delete\(':id\/series'\)/);
    assert.match(lessons, /async deleteStudentFutureFrom/);
    assert.match(lessons, /async deleteSeriesPlannedFrom/);
    assert.match(lessons, /withSeriesLock/);
    assert.match(lessons, /untilDate/);
    assert.match(lessons, /status = 'stopped'/);
    assert.match(lessons, /markSkipped/);
    assert.match(recurrence, /fresh\.status !== 'active'/);
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
