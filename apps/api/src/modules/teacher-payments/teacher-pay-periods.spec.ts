import {
  aggregateTeacherPaymentsByPeriod,
  getTeacherPayPeriodForDate,
} from './teacher-pay-periods';

describe('getTeacherPayPeriodForDate', () => {
  it('puts the 14th and 15th in the same calendar month', () => {
    const a = getTeacherPayPeriodForDate('2026-07-14');
    const b = getTeacherPayPeriodForDate('2026-07-15');
    expect(a?.month).toBe('2026-07');
    expect(b?.month).toBe('2026-07');
    expect(a?.start).toBe('2026-07-01');
    expect(a?.end).toBe('2026-07-31');
    expect(a?.payoutDate).toBe('2026-08-15');
    expect(a?.label).toMatch(/^Выплата за /);
  });
});

describe('aggregateTeacherPaymentsByPeriod', () => {
  it('groups by calendar month', () => {
    const lessonDateById = new Map([
      ['l1', '2026-07-14'],
      ['l2', '2026-07-15'],
      ['l3', '2026-06-20'],
    ]);
    const rows = aggregateTeacherPaymentsByPeriod(
      [
        { lessonId: 'l1', amount: '400' },
        { lessonId: 'l2', amount: 300 },
        { lessonId: 'l3', amount: 210 },
      ],
      lessonDateById,
    );
    expect(rows).toHaveLength(2);
    expect(rows[0].month).toBe('2026-07');
    expect(rows[0].amount).toBe(700);
    expect(rows[1].month).toBe('2026-06');
    expect(rows[1].amount).toBe(210);
  });
});
