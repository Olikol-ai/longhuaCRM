import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  aggregateTeacherPaymentsByPeriod,
  getTeacherPayPeriodForDate,
} from './teacherPayPeriods.js';

describe('getTeacherPayPeriodForDate', () => {
  it('puts the 14th and 15th in the same calendar month', () => {
    const a = getTeacherPayPeriodForDate('2026-07-14');
    const b = getTeacherPayPeriodForDate('2026-07-15');
    assert.equal(a.month, '2026-07');
    assert.equal(b.month, '2026-07');
    assert.equal(a.key, b.key);
    assert.equal(a.start, '2026-07-01');
    assert.equal(a.end, '2026-07-31');
    assert.equal(a.payoutDate, '2026-08-15');
    assert.match(a.label, /^Выплата за /);
    assert.match(a.label, /2026/);
  });

  it('uses month bounds for mid-month dates', () => {
    const period = getTeacherPayPeriodForDate('2026-08-01');
    assert.equal(period.month, '2026-08');
    assert.equal(period.start, '2026-08-01');
    assert.equal(period.end, '2026-08-31');
    assert.equal(period.payoutDate, '2026-09-15');
  });

  it('handles February length', () => {
    const period = getTeacherPayPeriodForDate('2026-02-10');
    assert.equal(period.start, '2026-02-01');
    assert.equal(period.end, '2026-02-28');
    assert.equal(period.payoutDate, '2026-03-15');
  });
});

describe('aggregateTeacherPaymentsByPeriod', () => {
  it('sums amounts by calendar month using lesson dates', () => {
    const lessons = [
      { id: 'l1', date: '2026-07-14' },
      { id: 'l2', date: '2026-07-15' },
      { id: 'l3', date: '2026-06-20' },
    ];
    const payments = [
      { id: 'p1', lesson_id: 'l1', amount: '400' },
      { id: 'p2', lesson_id: 'l2', amount: 300 },
      { id: 'p3', lesson_id: 'l3', amount: 210 },
    ];

    const rows = aggregateTeacherPaymentsByPeriod(payments, lessons);
    assert.equal(rows.length, 2);
    assert.equal(rows[0].month, '2026-07');
    assert.equal(rows[0].amount, 700);
    assert.equal(rows[0].paymentCount, 2);
    assert.equal(rows[0].payoutDate, '2026-08-15');
    assert.equal(rows[1].month, '2026-06');
    assert.equal(rows[1].amount, 210);
  });

  it('falls back to created_at when lesson is missing', () => {
    const rows = aggregateTeacherPaymentsByPeriod(
      [{ id: 'p1', amount: 100, created_at: '2026-06-20T10:00:00.000Z' }],
      [],
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].month, '2026-06');
    assert.equal(rows[0].start, '2026-06-01');
    assert.equal(rows[0].end, '2026-06-30');
    assert.equal(rows[0].amount, 100);
  });
});
