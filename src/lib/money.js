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
 * Format BYN for display: "1 500 BYN", "40 BYN", "1 250,50 BYN"
 */
export function formatCurrency(value) {
  const n = parseMoneyAmount(value);
  const formatted = new Intl.NumberFormat('ru-BY', {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} BYN`;
}

/** @deprecated Prefer formatCurrency — kept for existing imports */
export function formatMoneyByn(value) {
  return formatCurrency(value);
}
