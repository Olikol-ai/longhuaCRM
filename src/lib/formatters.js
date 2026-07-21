/**
 * Belarus / Russian UX formatters for Longhua Academy.
 * Currency: BYN. Dates: DD.MM.YYYY. Time: 24h.
 */

import { formatCurrency, parseMoneyAmount } from '@/lib/money';

export {
  formatCurrency,
  formatMoneyByn,
  parseMoneyAmount,
  sumPaymentAmounts,
} from '@/lib/money';

/** DD.MM.YYYY */
export function formatDate(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** DD.MM.YYYY HH:mm (24h) */
export function formatDateTime(value) {
  if (!value) return '—';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const pad = (n) => String(n).padStart(2, '0');
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Hourly rate: "40 BYN/ч" */
export function formatHourlyRateShort(value) {
  const n = parseMoneyAmount(value);
  const formatted = new Intl.NumberFormat('ru-BY', {
    maximumFractionDigits: 2,
  }).format(n);
  return `${formatted} BYN/ч`;
}

export function formatCurrencyAmount(value) {
  return formatCurrency(value);
}
