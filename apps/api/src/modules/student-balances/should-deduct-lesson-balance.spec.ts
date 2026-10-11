import {
  BALANCE_DEDUCT_LESSON_STATUSES,
  shouldDeductLessonBalance,
} from './student-balance-math';

describe('shouldDeductLessonBalance', () => {
  it('deducts only completed and missed_no_notice', () => {
    expect(shouldDeductLessonBalance('completed')).toBe(true);
    expect(shouldDeductLessonBalance('missed_no_notice')).toBe(true);
  });

  it('never deducts planned/cancelled/rescheduled/missed', () => {
    expect(shouldDeductLessonBalance('planned')).toBe(false);
    expect(shouldDeductLessonBalance('cancelled')).toBe(false);
    expect(shouldDeductLessonBalance('rescheduled')).toBe(false);
    expect(shouldDeductLessonBalance('missed')).toBe(false);
    expect(shouldDeductLessonBalance(null)).toBe(false);
    expect(shouldDeductLessonBalance(undefined)).toBe(false);
    expect(shouldDeductLessonBalance('')).toBe(false);
  });

  it('matches BALANCE_DEDUCT_LESSON_STATUSES exactly', () => {
    for (const status of BALANCE_DEDUCT_LESSON_STATUSES) {
      expect(shouldDeductLessonBalance(status)).toBe(true);
    }
  });
});

describe('Oxana cancelled regression (payment − completed, ignore cancelled)', () => {
  it('payment +12 with 10 completed and 2 cancelled => balance 2', () => {
    const paymentCredits = 12;
    const lessons = [
      ...Array.from({ length: 10 }, () => 'completed' as const),
      ...Array.from({ length: 2 }, () => 'cancelled' as const),
    ];
    const deductions = lessons.filter((s) => shouldDeductLessonBalance(s)).length;
    const cancelledDeducted = lessons.filter(
      (s) => s === 'cancelled' && shouldDeductLessonBalance(s),
    ).length;
    expect(cancelledDeducted).toBe(0);
    expect(deductions).toBe(10);
    expect(paymentCredits - deductions).toBe(2);
  });
});
