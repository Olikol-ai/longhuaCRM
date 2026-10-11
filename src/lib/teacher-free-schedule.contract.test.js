import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

function read(rel) {
  return readFileSync(join(root, rel), 'utf8');
}

describe('teacher free schedule', () => {
  it('exposes free-schedule endpoint and subtracts lessons from availability', () => {
    const controller = read('apps/api/src/modules/schedule/schedule.controller.ts');
    const service = read('apps/api/src/modules/schedule/schedule.service.ts');
    const util = read('apps/api/src/modules/schedule/teacher-free-schedule.util.ts');
    const api = read('src/api/schedule.js');
    const schedulePage = read('src/pages/Schedule.jsx');
    const dialog = read('src/components/schedule/TeacherFreeScheduleDialog.jsx');
    const lessonModal = read('src/components/schedule/LessonModal.jsx');
    const detailModal = read('src/components/schedule/LessonDetailModal.jsx');

    assert.match(controller, /@Get\('free-schedule'\)/);
    assert.match(controller, /excludeLessonId|exclude_lesson_id/);
    assert.match(service, /getFreeSchedule/);
    assert.match(service, /computeFreeClockIntervals/);
    assert.match(service, /occupied/);
    assert.match(service, /excludeLessonId/);
    assert.match(util, /subtractBusyFromAvailability/);
    assert.match(api, /getFreeSchedule/);
    assert.match(api, /exclude_lesson_id/);
    assert.match(schedulePage, /Свободный график/);
    assert.match(schedulePage, /TeacherFreeScheduleDialog/);
    assert.match(dialog, /getFreeSchedule/);
    assert.match(lessonModal, /🟢 Свободен/);
    assert.match(lessonModal, /checkTeacherAvailability/);
    assert.match(detailModal, /exclude_lesson_id: lesson\.id/);
  });
});
