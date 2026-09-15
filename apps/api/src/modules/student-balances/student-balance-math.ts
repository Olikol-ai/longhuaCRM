/**
 * Pure money math for admin Balance page.
 *
 * Pack model SSOT:
 * - Remaining lessons live in students.lesson_balance (updated by payments / lesson completion).
 * - Unit price is derived from the student's own paid payments that credited lessons
 *   (amount / lessons_added). No invented tariff.
 *
 * Money position must stay consistent with lesson_balance:
 *   money ≈ (paid − paid_for_lessons) + lesson_balance × unitPrice
 *
 * Equivalent form with historical import credit:
 *   historicalLessons = lessonBalance + conducted − purchased
 *   money = paid + historicalLessons × unitPrice − conducted × unitPrice
 *
 * This prevents false "debt" when CRM tracked conducted lessons that were already
 * prepaid before the student was imported (opening balance missing from payments).
 */

export const BALANCE_DEDUCT_LESSON_STATUSES = ['completed', 'missed_no_notice'] as const;

export type MoneyPosition = {
  paidAmount: number;
  lessonsPurchased: number;
  lessonBalance: number;
  /** Implied prepaid lessons at CRM import: balance + conducted − purchased */
  historicalLessonsCredit: number;
  unitPrice: number | null;
  conductedLessons: number;
  costConducted: number | null;
  /** paid + historical×unit − costConducted; positive = overpayment/advance, negative = debt */
  moneyPosition: number | null;
  debtAmount: number;
  overpaymentAmount: number;
};

export function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Weighted unit price from package/manual payments that added lessons.
 * Returns null when the student has no lesson-crediting payments.
 */
export function deriveUnitPrice(
  paidAmountForLessons: number,
  lessonsPurchased: number,
): number | null {
  if (!Number.isFinite(paidAmountForLessons) || !Number.isFinite(lessonsPurchased)) {
    return null;
  }
  if (lessonsPurchased <= 0) {
    return null;
  }
  return roundMoney(paidAmountForLessons / lessonsPurchased);
}

/**
 * Historical lessons credit implied by the pack equation:
 * lessonBalance = purchased + historical − conducted
 * ⇒ historical = lessonBalance − purchased + conducted
 */
export function impliedHistoricalLessonsCredit(input: {
  lessonBalance: number;
  lessonsPurchased: number;
  conductedLessons: number;
}): number {
  const lessonBalance = Math.trunc(Number(input.lessonBalance) || 0);
  const lessonsPurchased = Math.max(0, Math.trunc(Number(input.lessonsPurchased) || 0));
  const conductedLessons = Math.max(0, Math.trunc(Number(input.conductedLessons) || 0));
  return lessonBalance - lessonsPurchased + conductedLessons;
}

export function computeMoneyPosition(input: {
  paidAmount: number;
  paidAmountForLessons: number;
  lessonsPurchased: number;
  conductedLessons: number;
  lessonBalance: number;
}): MoneyPosition {
  const paidAmount = roundMoney(Number(input.paidAmount) || 0);
  const paidAmountForLessons = roundMoney(Number(input.paidAmountForLessons) || 0);
  const lessonsPurchased = Math.max(0, Math.trunc(Number(input.lessonsPurchased) || 0));
  const conductedLessons = Math.max(0, Math.trunc(Number(input.conductedLessons) || 0));
  const lessonBalance = Math.trunc(Number(input.lessonBalance) || 0);
  const historicalLessonsCredit = impliedHistoricalLessonsCredit({
    lessonBalance,
    lessonsPurchased,
    conductedLessons,
  });
  const unitPrice = deriveUnitPrice(paidAmountForLessons, lessonsPurchased);

  if (unitPrice == null) {
    return {
      paidAmount,
      lessonsPurchased,
      lessonBalance,
      historicalLessonsCredit,
      unitPrice: null,
      conductedLessons,
      costConducted: null,
      moneyPosition: null,
      debtAmount: 0,
      overpaymentAmount: 0,
    };
  }

  const costConducted = roundMoney(unitPrice * conductedLessons);
  // Pack-aligned: non-lesson cash + remaining pack value.
  // Equals paid + historical×unit − costConducted.
  const moneyPosition = roundMoney(
    paidAmount - paidAmountForLessons + unitPrice * lessonBalance,
  );

  return {
    paidAmount,
    lessonsPurchased,
    lessonBalance,
    historicalLessonsCredit,
    unitPrice,
    conductedLessons,
    costConducted,
    moneyPosition,
    debtAmount: moneyPosition < 0 ? roundMoney(-moneyPosition) : 0,
    overpaymentAmount: moneyPosition > 0 ? moneyPosition : 0,
  };
}

export function formatMoneyPositionLabel(position: MoneyPosition): string {
  if (position.moneyPosition == null) {
    return '—';
  }
  if (position.debtAmount > 0) {
    return `Должен: ${position.debtAmount}`;
  }
  if (position.overpaymentAmount > 0) {
    return `Переплата: ${position.overpaymentAmount}`;
  }
  return '0';
}
