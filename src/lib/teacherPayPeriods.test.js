import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateTeacherPaymentsByPeriod,
  getTeacherPayPeriodForDate,
} from './teacherPayPeriods.js';

describe('getTeacherPayPeriodForDate', () => {
  it('puts the 14th in the previous period', () => {
    const period = getTeacherPayPeriodForDate('2026-07-14');
    assert.equal(period.start, '2026-06-15');
    assert.equal(period.end, '2026-07-14');
    assert.equal(period.label, '15.06.2026 — 14.07.2026');
  });

  it('puts the 15th in the next period', () => {
    const period = getTeacherPayPeriodForDate('2026-07-15');
    assert.equal(period.start, '2026-07-15');
    assert.equal(period.end, '2026-08-14');
    assert.equal(period.label, '15.07.2026 — 14.08.2026');
  });

  it('keeps mid-period dates inside the open window', () => {
    const period = getTeacherPayPeriodForDate('2026-08-01');
    assert.equal(period.start, '2026-07-15');
    assert.equal(period.end, '2026-08-14');
  });
});

describe('aggregateTeacherPaymentsByPeriod', () => {
  it('sums amounts by payroll period using lesson dates', () => {
    const lessons = [
      { id: 'l1', date: '2026-07-14' },
      { id: 'l2', date: '2026-07-15' },
      { id: 'l3', date: '2026-07-20' },
    ];
    const payments = [
      { id: 'p1', lesson_id: 'l1', amount: '400' },
      { id: 'p2', lesson_id: 'l2', amount: 300 },
      { id: 'p3', lesson_id: 'l3', amount: 210 },
    ];

    const rows = aggregateTeacherPaymentsByPeriod(payments, lessons);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].label, '15.07.2026 — 14.08.2026');
    assert.equal(rows[0].amount, 510);
    assert.equal(rows[0].paymentCount, 2);
    assert.equal(rows[1].label, '15.06.2026 — 14.07.2026');
    assert.equal(rows[1].amount, 400);
  });

  it('falls back to created_at when lesson is missing', () => {
    const rows = aggregateTeacherPaymentsByPeriod(
      [{ id: 'p1', amount: 100, created_at: '2026-06-20T10:00:00.000Z' }],
      [],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].start, '2026-06-15');
    assert.equal(rows[0].end, '2026-07-14');
    assert.equal(rows[0].amount, 100);
  });
});
