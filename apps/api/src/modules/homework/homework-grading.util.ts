export type HomeworkGradingMode = 'auto' | 'manual';

export function normalizeHomeworkGradingMode(
  value: unknown,
): HomeworkGradingMode {
  return value === 'manual' ? 'manual' : 'auto';
}

export function computeAutoHomeworkPercent(
  earnedPoints: number,
  maxPoints: number,
): number {
  if (!(maxPoints > 0) || !Number.isFinite(earnedPoints)) {
    return 0;
  }
  return Math.round((earnedPoints / maxPoints) * 10000) / 100;
}

export function clampHomeworkPercent(value: number): number {
  if (!Number.isFinite(value)) {
    throw new Error('Percentage must be a number');
  }
  if (value < 0 || value > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  return Math.round(value * 100) / 100;
}

/**
 * Auto: earned / max * 100.
 * Manual: stored manual percentage — never recomputed from item scores.
 */
export function resolveHomeworkPercent(input: {
  gradingMode: unknown;
  manualPercentage: number | string | null | undefined;
  earnedPoints: number;
  maxPoints: number;
}): number {
  const mode = normalizeHomeworkGradingMode(input.gradingMode);
  if (mode === 'manual') {
    const raw =
      input.manualPercentage == null || input.manualPercentage === ''
        ? NaN
        : Number(input.manualPercentage);
    return clampHomeworkPercent(raw);
  }
  return computeAutoHomeworkPercent(input.earnedPoints, input.maxPoints);
}
