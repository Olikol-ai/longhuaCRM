import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { assertNonProductionBase } from './assert-non-production-base.mjs';

describe('assertNonProductionBase', () => {
  it('allows localhost verification targets', () => {
    assert.equal(
      assertNonProductionBase('http://127.0.0.1:3001'),
      'http://127.0.0.1:3001',
    );
  });

  it('refuses production lk.longhuachinese.online', () => {
    assert.throws(
      () => assertNonProductionBase('https://lk.longhuachinese.online'),
      /refusing to run against production/,
    );
  });

  it('refuses production even when BASE_URL is overridden with trailing slash', () => {
    assert.throws(
      () => assertNonProductionBase('https://lk.longhuachinese.online/'),
      /refusing to run against production/,
    );
  });
});
