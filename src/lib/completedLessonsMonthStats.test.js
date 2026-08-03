import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeCompletedLessonsMonthStats,
  formatCompletedMonthComparison,
  parseLessonCalendarDate,
} from './completedLessonsMonthStats.js';

describe('completedLessonsMonthStats', () => {
  it('parses YYYY-MM-DD without UTC day shift', () => {
    const d = parseLessonCalendarDate('2026-06-01');
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 5);
    assert.equal(d.getDate(), 1);
  });

  it('counts only completed lessons in calendar months', () => {
    const now = new Date(2026, 5, 15); // 15 June 2026
    const lessons = [
      { status: 'completed', date: '2026-06-01' },
      { status: 'completed', date: '2026-06-15' },
      { status: 'planned', date: '2026-06-10' },
      { status: 'cancelled', date: '2026-06-02' },
      { status: 'missed', date: '2026-06-03' },
      { status: 'rescheduled', date: '2026-06-04' },
      { status: 'completed', date: '2026-05-01' },
      { status: 'completed', date: '2026-05-20' },
      { status: 'completed', date: '2026-05-31' },
      { status: 'completed', date: '2026-04-30' },
    ];
    const stats = computeCompletedLessonsMonthStats(lessons, now);
    assert.equal(stats.currentCount, 2);
    assert.equal(stats.previousCount, 3);
    assert.equal(stats.delta, -1);
    assert.equal(stats.trend, 'down');
  });

  it('handles empty months and growth', () => {
    const now = new Date(2026, 5, 30);
    const empty = computeCompletedLessonsMonthStats([], now);
    assert.equal(empty.currentCount, 0);
    assert.equal(empty.previousCount, 0);
    assert.equal(empty.trend, 'flat');

    const onlyCurrent = computeCompletedLessonsMonthStats(
      [
        { status: 'completed', date: '2026-06-01' },
        { status: 'completed', date: '2026-06-02' },
      ],
      now,
    );
    assert.equal(onlyCurrent.currentCount, 2);
    assert.equal(onlyCurrent.previousCount, 0);
    assert.equal(onlyCurrent.trend, 'up');
    assert.equal(onlyCurrent.percentChange, null);

    const up = computeCompletedLessonsMonthStats(
      [
        { status: 'completed', date: '2026-06-01' },
        { status: 'completed', date: '2026-06-02' },
        { status: 'completed', date: '2026-05-10' },
      ],
      now,
    );
    assert.equal(up.delta, 1);
    assert.equal(up.trend, 'up');
    assert.equal(up.percentChange, 100);
  });

  it('formats comparison copy', () => {
    const formatted = formatCompletedMonthComparison({
      currentCount: 42,
      previousCount: 38,
      delta: 4,
      trend: 'up',
      percentChange: 11,
    });
    assert.equal(formatted.label, 'Проведено в этом месяце');
    assert.equal(formatted.value, 42);
    assert.equal(formatted.previousLine, 'В прошлом месяце: 38');
    assert.match(formatted.trendLine, /↑ \+4/);
    assert.equal(formatted.trendTone, 'up');

    const flat = formatCompletedMonthComparison({
      currentCount: 0,
      previousCount: 0,
      delta: 0,
      trend: 'flat',
      percentChange: null,
    });
    assert.equal(flat.trendLine, 'Без изменений');
  });
});
