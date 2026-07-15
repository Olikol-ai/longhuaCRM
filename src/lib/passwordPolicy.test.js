import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { REGISTRATION_PASSWORD_HINT } from './passwordPolicy.js';

describe('passwordPolicy UI copy', () => {
  it('hint mentions Latin letter and digit (aligned with backend policy)', () => {
    assert.match(REGISTRATION_PASSWORD_HINT, /латинск/i);
    assert.match(REGISTRATION_PASSWORD_HINT, /цифр/i);
    assert.match(REGISTRATION_PASSWORD_HINT, /6/);
  });
});
