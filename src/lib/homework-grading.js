/**
 * Homework overall percent: auto = earned/max, manual = teacher value.
 * Difficulty is never part of this formula.
 */

export function normalizeHomeworkGradingMode(value) {
  return value === 'manual' ? 'manual' : 'auto';
}

export function computeAutoHomeworkPercent(earnedPoints, maxPoints) {
  const earned = Number(earnedPoints);
  const max = Number(maxPoints);
  if (!(max > 0) || !Number.isFinite(earned)) {
    return 0;
  }
  return Math.round((earned / max) * 10000) / 100;
}

export function clampHomeworkPercent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error('Percentage must be a number');
  }
  if (n < 0 || n > 100) {
    throw new Error('Percentage must be between 0 and 100');
  }
  return Math.round(n * 100) / 100;
}

export function resolveHomeworkPercent({
  gradingMode,
  manualPercentage,
  earnedPoints,
  maxPoints,
}) {
  const mode = normalizeHomeworkGradingMode(gradingMode);
  if (mode === 'manual') {
    const raw =
      manualPercentage == null || manualPercentage === ''
        ? NaN
        : Number(manualPercentage);
    return clampHomeworkPercent(raw);
  }
  return computeAutoHomeworkPercent(earnedPoints, maxPoints);
}

export function sumHomeworkItemPoints(questions, scores, answersByQuestionId) {
  let earned = 0;
  let max = 0;
  for (const question of questions || []) {
    max += Number(question.points) || 0;
    const raw = scores?.[question.id];
    if (raw !== undefined && raw !== '') {
      earned += Number(raw) || 0;
    } else {
      const answer = answersByQuestionId?.get?.(question.id);
      earned += Number(answer?.earned_points ?? 0);
    }
  }
  return { earned, max };
}
