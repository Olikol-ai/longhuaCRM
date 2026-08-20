import {
  computeAutoHomeworkPercent,
  normalizeHomeworkGradingMode,
  resolveHomeworkPercent,
} from './homework-grading.util';

describe('homework grading percent', () => {
  it('auto grading is earned / max * 100', () => {
    expect(computeAutoHomeworkPercent(8, 10)).toBe(80);
    expect(computeAutoHomeworkPercent(6.4, 11)).toBe(58.18);
    expect(
      resolveHomeworkPercent({
        gradingMode: 'auto',
        manualPercentage: 80,
        earnedPoints: 6.4,
        maxPoints: 11,
      }),
    ).toBe(58.18);
  });

  it('manual grading keeps the teacher percentage', () => {
    expect(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: 80,
        earnedPoints: 6.4,
        maxPoints: 11,
      }),
    ).toBe(80);
  });

  it('changing item scores does not change a stored manual percentage', () => {
    const manual = 80;
    expect(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: manual,
        earnedPoints: 2,
        maxPoints: 11,
      }),
    ).toBe(80);
    expect(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: manual,
        earnedPoints: 11,
        maxPoints: 11,
      }),
    ).toBe(80);
  });

  it('switching auto → manual uses the manual value', () => {
    expect(normalizeHomeworkGradingMode('manual')).toBe('manual');
    expect(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: 80,
        earnedPoints: 1,
        maxPoints: 10,
      }),
    ).toBe(80);
  });

  it('switching manual → auto recomputes from points', () => {
    expect(normalizeHomeworkGradingMode('auto')).toBe('auto');
    expect(normalizeHomeworkGradingMode(null)).toBe('auto');
    expect(
      resolveHomeworkPercent({
        gradingMode: 'auto',
        manualPercentage: 80,
        earnedPoints: 9,
        maxPoints: 10,
      }),
    ).toBe(90);
  });
});
