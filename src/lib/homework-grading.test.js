import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeAutoHomeworkPercent,
  normalizeHomeworkGradingMode,
  resolveHomeworkPercent,
  sumHomeworkItemPoints,
} from './homework-grading.js';

describe('homework grading percent', () => {
  it('auto grading is earned / max * 100', () => {
    assert.equal(computeAutoHomeworkPercent(8, 10), 80);
    assert.equal(computeAutoHomeworkPercent(6.4, 11), 58.18);
    assert.equal(
      resolveHomeworkPercent({
        gradingMode: 'auto',
        manualPercentage: 80,
        earnedPoints: 6.4,
        maxPoints: 11,
      }),
      58.18,
    );
  });

  it('manual grading keeps the teacher percentage', () => {
    assert.equal(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: 80,
        earnedPoints: 6.4,
        maxPoints: 11,
      }),
      80,
    );
  });

  it('changing item scores does not change a stored manual percentage', () => {
    const manual = 80;
    assert.equal(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: manual,
        earnedPoints: 2,
        maxPoints: 11,
      }),
      80,
    );
    assert.equal(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: manual,
        earnedPoints: 11,
        maxPoints: 11,
      }),
      80,
    );
  });

  it('switching auto → manual uses the manual value', () => {
    assert.equal(normalizeHomeworkGradingMode('manual'), 'manual');
    assert.equal(
      resolveHomeworkPercent({
        gradingMode: 'manual',
        manualPercentage: 80,
        earnedPoints: 1,
        maxPoints: 10,
      }),
      80,
    );
  });

  it('switching manual → auto recomputes from points', () => {
    assert.equal(normalizeHomeworkGradingMode('auto'), 'auto');
    assert.equal(normalizeHomeworkGradingMode(null), 'auto');
    assert.equal(normalizeHomeworkGradingMode(undefined), 'auto');
    assert.equal(
      resolveHomeworkPercent({
        gradingMode: 'auto',
        manualPercentage: 80,
        earnedPoints: 9,
        maxPoints: 10,
      }),
      90,
    );
  });

  it('item points are summed independently of difficulty', () => {
    const questions = [
      { id: 'a', points: 2, difficulty: 5 },
      { id: 'b', points: 2, difficulty: 1 },
    ];
    const scores = { a: '2', b: '1.5' };
    const totals = sumHomeworkItemPoints(questions, scores, new Map());
    assert.equal(totals.earned, 3.5);
    assert.equal(totals.max, 4);
    assert.equal(computeAutoHomeworkPercent(totals.earned, totals.max), 87.5);
  });
});
