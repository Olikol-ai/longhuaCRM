/** Parse API/DB money values (number or numeric string) for arithmetic. */
export function parseMoneyAmount(value) {
  if (value === null || value === undefined || value === "") return 0;
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
}

/** Sum payment amounts without string concatenation. */
export function sumPaymentAmounts(payments) {
  return payments.reduce((sum, item) => sum + parseMoneyAmount(item?.amount), 0);
}

/** Format BYN for display after numeric calculation. */
export function formatMoneyByn(value) {
  return `${parseMoneyAmount(value).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} BYN`;
}
