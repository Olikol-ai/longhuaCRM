/** Parse API/DB money values (number or numeric string) for arithmetic. */
export function parseMoneyAmount(value) {
  if (value === null || value === undefined || value === '') return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Sum payment amounts without string concatenation. */
export function sumPaymentAmounts(payments) {
  return payments.reduce((sum, item) => sum + parseMoneyAmount(item?.amount), 0);
}

/**
 * ISO 4217 code for display.
 *
 * The official NBRB graphical sign (Unicode U+20C5 BELARUSIAN RUBLE SIGN)
 * is only provisionally assigned and is not in OS fonts until Unicode 19
 * (expected 2027). Do not insert a homemade glyph — use "BYN".
 */
export const BYN_CODE = 'BYN';

function formatNumber(n) {
  return new Intl.NumberFormat('ru-BY', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
}

/**
 * Canonical money display: amount + one currency label.
 * "1 500 BYN", "40 BYN", "1 250,50 BYN", "0 BYN", "−100 BYN"
 *
 * Never append BYN again in UI. Use {formatBYN(amount)} only.
 */
export function formatBYN(value) {
  const n = parseMoneyAmount(value);
  return `${formatNumber(n)} ${BYN_CODE}`;
}

/** @deprecated Use formatBYN — same output, kept for existing imports */
export function formatCurrency(value) {
  return formatBYN(value);
}

/** @deprecated Prefer formatBYN */
export function formatMoneyByn(value) {
  return formatBYN(value);
}
