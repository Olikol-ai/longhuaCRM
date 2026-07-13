import { ValueTransformer } from 'typeorm';

/** PostgreSQL `numeric` is returned as string by the driver — coerce to number on read. */
export const decimalColumnTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | number | null | undefined): number | null => {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    if (typeof value === 'number') {
      return Number.isFinite(value) ? value : null;
    }
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
  },
};

export function coerceDecimalValue(value: string | number | null | undefined, fallback = 0): number {
  const parsed = decimalColumnTransformer.from(value);
  return parsed ?? fallback;
}
