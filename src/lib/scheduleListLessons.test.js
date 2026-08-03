import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  filterScheduleListLessons,
  isScheduleListFinalStatus,
  isScheduleListRelevantLesson,
} from './scheduleListLessons.js';

describe('scheduleListLessons', () => {
  it('treats completed / cancelled / rescheduled / missed as final', () => {
    assert.equal(isScheduleListFinalStatus('completed'), true);
    assert.equal(isScheduleListFinalStatus('cancelled'), true);
    assert.equal(isScheduleListFinalStatus('rescheduled'), true);
    assert.equal(isScheduleListFinalStatus('missed'), true);
    assert.equal(isScheduleListFinalStatus('missed_no_notice'), true);
    assert.equal(isScheduleListFinalStatus('planned'), false);
  });

  it('hides final lessons from the work list by default', () => {
    const lessons = [
      { id: '1', date: '2026-06-15', start_time: '09:00', status: 'completed' },
      { id: '2', date: '2026-06-15', start_time: '11:00', status: 'cancelled' },
      { id: '3', date: '2026-08-05', start_time: '09:00', status: 'completed' },
      { id: '4', date: '2026-08-05', start_time: '16:00', status: 'planned' },
      { id: '5', date: '2026-08-06', start_time: '18:30', status: 'planned' },
      { id: '6', date: '2026-08-05', start_time: '08:00', status: 'planned' },
      { id: '7', date: '2026-08-04', start_time: '10:00', status: 'rescheduled' },
      { id: '8', date: '2026-08-04', start_time: '12:00', status: 'missed' },
    ];

    const visible = filterScheduleListLessons(lessons);
    assert.deepEqual(
      visible.map((l) => l.id),
      ['6', '4', '5'],
    );
  });

  it('keeps overdue planned lessons that still need an action', () => {
    assert.equal(
      isScheduleListRelevantLesson({
        id: 'old',
        date: '2026-06-15',
        start_time: '09:00',
        status: 'planned',
      }),
      true,
    );
  });

  it('can include final lessons when the history filter is on', () => {
    const lessons = [
      { id: '1', date: '2026-08-05', start_time: '09:00', status: 'completed' },
      { id: '2', date: '2026-08-05', start_time: '16:00', status: 'planned' },
    ];
    const withHistory = filterScheduleListLessons(lessons, { includeFinal: true });
    assert.deepEqual(
      withHistory.map((l) => l.id),
      ['1', '2'],
    );
  });

  it('sorts by date and start time ascending', () => {
    const visible = filterScheduleListLessons([
      { id: 'b', date: '2026-08-07', start_time: '10:00', status: 'planned' },
      { id: 'a', date: '2026-08-06', start_time: '18:00', status: 'planned' },
      { id: 'c', date: '2026-08-06', start_time: '09:00', status: 'planned' },
    ]);
    assert.deepEqual(
      visible.map((l) => l.id),
      ['c', 'a', 'b'],
    );
  });
});
