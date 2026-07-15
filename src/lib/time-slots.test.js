import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { formatTime } from './time-slots.js';

describe('formatTime', () => {
  it('strips seconds from HH:MM:SS', () => {
    assert.equal(formatTime('10:00:00'), '10:00');
    assert.equal(formatTime('09:30:00'), '09:30');
    assert.equal(formatTime('00:00:00'), '00:00');
  });

  it('keeps HH:MM as-is (padded hours)', () => {
    assert.equal(formatTime('10:00'), '10:00');
    assert.equal(formatTime('9:05'), '09:05');
  });

  it('handles empty and non-time values', () => {
    assert.equal(formatTime(''), '');
    assert.equal(formatTime(null), '');
    assert.equal(formatTime('not-a-time'), 'not-a-time');
  });
});
