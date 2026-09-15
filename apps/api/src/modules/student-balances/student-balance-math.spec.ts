import {
  computeMoneyPosition,
  deriveUnitPrice,
  formatMoneyPositionLabel,
  impliedHistoricalLessonsCredit,
  roundMoney,
} from './student-balance-math';

describe('student-balance-math', () => {
  it('derives unit price from pack payments', () => {
    expect(deriveUnitPrice(360, 8)).toBe(45);
    expect(deriveUnitPrice(180, 4)).toBe(45);
    expect(deriveUnitPrice(100, 0)).toBeNull();
  });

  it('implies historical credit from pack equation', () => {
    // Babaeva: 1 remaining, 8 purchased, 11 conducted → 4 historical
    expect(impliedHistoricalLessonsCredit({
      lessonBalance: 1,
      lessonsPurchased: 8,
      conductedLessons: 11,
    })).toBe(4);
    // Clean pack: remaining = purchased − conducted
    expect(impliedHistoricalLessonsCredit({
      lessonBalance: 4,
      lessonsPurchased: 12,
      conductedLessons: 8,
    })).toBe(0);
  });

  it('does not show false debt when historical prepaid lessons exist (Babaeva case)', () => {
    const result = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 11,
      lessonBalance: 1,
    });
    expect(result.unitPrice).toBe(45);
    expect(result.historicalLessonsCredit).toBe(4);
    expect(result.costConducted).toBe(495);
    expect(result.moneyPosition).toBe(45);
    expect(result.debtAmount).toBe(0);
    expect(result.overpaymentAmount).toBe(45);
  });

  it('shows zero money when Konchits-style historical closes the gap', () => {
    const result = computeMoneyPosition({
      paidAmount: 100,
      paidAmountForLessons: 100,
      lessonsPurchased: 2,
      conductedLessons: 3,
      lessonBalance: 0,
    });
    expect(result.historicalLessonsCredit).toBe(1);
    expect(result.moneyPosition).toBe(0);
    expect(result.debtAmount).toBe(0);
    expect(formatMoneyPositionLabel(result)).toBe('0');
  });

  it('values Filimonova remaining pack after historical credit', () => {
    const result = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 10,
      lessonBalance: 4,
    });
    expect(result.historicalLessonsCredit).toBe(6);
    expect(result.moneyPosition).toBe(180);
    expect(result.overpaymentAmount).toBe(180);
    expect(result.debtAmount).toBe(0);
  });

  it('computes real debt when lesson_balance is negative', () => {
    const result = computeMoneyPosition({
      paidAmount: 180,
      paidAmountForLessons: 180,
      lessonsPurchased: 4,
      conductedLessons: 6,
      lessonBalance: -2,
    });
    expect(result.historicalLessonsCredit).toBe(0);
    expect(result.moneyPosition).toBe(-90);
    expect(result.debtAmount).toBe(90);
    expect(formatMoneyPositionLabel(result)).toContain('Должен');
  });

  it('matches legacy paid−cost when there is no historical credit', () => {
    const result = computeMoneyPosition({
      paidAmount: 540,
      paidAmountForLessons: 540,
      lessonsPurchased: 12,
      conductedLessons: 8,
      lessonBalance: 4,
    });
    expect(result.historicalLessonsCredit).toBe(0);
    expect(result.costConducted).toBe(360);
    expect(result.overpaymentAmount).toBe(180);
    expect(result.debtAmount).toBe(0);
  });

  it('returns zero money position when paid equals cost and balance is zero', () => {
    const result = computeMoneyPosition({
      paidAmount: 180,
      paidAmountForLessons: 180,
      lessonsPurchased: 4,
      conductedLessons: 4,
      lessonBalance: 0,
    });
    expect(result.moneyPosition).toBe(0);
    expect(formatMoneyPositionLabel(result)).toBe('0');
  });

  it('keeps advance after payment with no conducted lessons', () => {
    const result = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 0,
      lessonBalance: 8,
    });
    expect(result.moneyPosition).toBe(360);
    expect(result.overpaymentAmount).toBe(360);
  });

  it('decrements money with lesson_balance after one conducted lesson', () => {
    const after = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 1,
      lessonBalance: 7,
    });
    expect(after.moneyPosition).toBe(315);
    expect(after.historicalLessonsCredit).toBe(0);
  });

  it('stays consistent after historical credit when a new lesson is conducted', () => {
    const before = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 11,
      lessonBalance: 1,
    });
    const after = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 12,
      lessonBalance: 0,
    });
    expect(before.historicalLessonsCredit).toBe(4);
    expect(after.historicalLessonsCredit).toBe(4);
    expect(after.moneyPosition).toBe(roundMoney(before.moneyPosition! - 45));
  });

  it('stays consistent after new payment on top of historical credit', () => {
    const before = computeMoneyPosition({
      paidAmount: 360,
      paidAmountForLessons: 360,
      lessonsPurchased: 8,
      conductedLessons: 11,
      lessonBalance: 1,
    });
    const after = computeMoneyPosition({
      paidAmount: 540,
      paidAmountForLessons: 540,
      lessonsPurchased: 12,
      conductedLessons: 11,
      lessonBalance: 5,
    });
    expect(before.historicalLessonsCredit).toBe(4);
    expect(after.historicalLessonsCredit).toBe(4);
    expect(after.moneyPosition).toBe(roundMoney(before.moneyPosition! + 180));
  });

  it('does not invent a unit price without lesson-crediting payments', () => {
    const result = computeMoneyPosition({
      paidAmount: 100,
      paidAmountForLessons: 0,
      lessonsPurchased: 0,
      conductedLessons: 3,
      lessonBalance: 0,
    });
    expect(result.unitPrice).toBeNull();
    expect(result.costConducted).toBeNull();
    expect(result.moneyPosition).toBeNull();
    expect(result.debtAmount).toBe(0);
    expect(formatMoneyPositionLabel(result)).toBe('—');
  });

  it('rounds money to 2 decimals', () => {
    expect(roundMoney(10.1 + 0.2)).toBe(10.3);
    expect(roundMoney(45 * 3)).toBe(135);
  });
});
