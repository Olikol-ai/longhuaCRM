export function parseMoney(value: string | number): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function roundMoney(value: number): string {
  return value.toFixed(2);
}

export function computeCommission(amount: string | number, ratePercent: string | number): string {
  const base = parseMoney(amount);
  const rate = parseMoney(ratePercent);
  return roundMoney((base * rate) / 100);
}
