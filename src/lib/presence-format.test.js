import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDirectPresence } from './presence-format.js';

test('online label', () => {
  assert.equal(formatDirectPresence(new Date().toISOString(), true), '● В сети');
});

test('recent offline', () => {
  const recent = new Date(Date.now() - 5 * 60 * 1000).toISOString();
  assert.equal(formatDirectPresence(recent, false), 'Был(а) недавно');
});

test('today offline', () => {
  const earlier = new Date();
  earlier.setHours(Math.max(0, earlier.getHours() - 3), 0, 0, 0);
  if (Date.now() - earlier.getTime() < 15 * 60 * 1000) {
    earlier.setHours(0, 0, 0, 0);
  }
  if (Date.now() - earlier.getTime() < 15 * 60 * 1000) {
    // Skip flaky midnight edge — still assert function returns a string.
    assert.equal(typeof formatDirectPresence(earlier.toISOString(), false), 'string');
    return;
  }
  const label = formatDirectPresence(earlier.toISOString(), false);
  assert.match(label, /^Был\(а\) сегодня в /);
});
