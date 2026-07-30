import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeCryptoMe, normalizePublicKey } from '../../api/crypto-normalize.js';

test('normalizeCryptoMe accepts snake_case API payload', () => {
  const me = normalizeCryptoMe({
    configured: true,
    user_id: 'u1',
    public_key: 'pk',
    wrapped_private_key: 'wpk',
    wrap_salt: 'salt',
    wrap_iv: 'iv',
    kdf: 'pbkdf2-sha256',
    kdf_iterations: 310000,
    key_version: 2,
  });
  assert.equal(me.configured, true);
  assert.equal(me.userId, 'u1');
  assert.equal(me.publicKey, 'pk');
  assert.equal(me.wrappedPrivateKey, 'wpk');
  assert.equal(me.wrapSalt, 'salt');
  assert.equal(me.wrapIv, 'iv');
  assert.equal(me.kdfIterations, 310000);
  assert.equal(me.keyVersion, 2);
  assert.equal(me.needsActivation, false);
});

test('normalizeCryptoMe detects server-hold activation', () => {
  const me = normalizeCryptoMe({
    public_key: 'pk',
    kdf: 'server-hold-v1',
    wrapped_private_key: 'x',
    wrap_salt: 's',
    wrap_iv: 'i',
  });
  assert.equal(me.configured, true);
  assert.equal(me.needsActivation, true);
});

test('normalizePublicKey accepts snake_case', () => {
  const pub = normalizePublicKey({
    user_id: 'u2',
    public_key: 'abc',
    key_version: 1,
  });
  assert.equal(pub.userId, 'u2');
  assert.equal(pub.publicKey, 'abc');
});
