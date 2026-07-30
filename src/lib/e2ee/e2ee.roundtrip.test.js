import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAndWrapIdentity,
  unwrapPrivateKey,
  publicKeyToBase64,
} from './keys.js';
import { encryptDirectMessage, decryptDirectMessage } from './message.js';

test('wrap/unwrap private key roundtrip', async () => {
  const password = 'Test-Password-123!';
  const identity = await createAndWrapIdentity(password);
  const restored = await unwrapPrivateKey(
    identity.wrappedPrivateKey,
    identity.wrapSalt,
    identity.wrapIv,
    password,
    identity.kdfIterations,
  );
  assert.equal(restored.length, identity.privateKey.length);
  assert.deepEqual([...restored], [...identity.privateKey]);
});

test('wrong password fails unwrap', async () => {
  const identity = await createAndWrapIdentity('correct-password');
  await assert.rejects(
    () =>
      unwrapPrivateKey(
        identity.wrappedPrivateKey,
        identity.wrapSalt,
        identity.wrapIv,
        'wrong-password',
        identity.kdfIterations,
      ),
    /пароль|ключ/i,
  );
});

test('encrypt/decrypt Direct message between two keypairs', async () => {
  const alice = await createAndWrapIdentity('alice-pass');
  const bob = await createAndWrapIdentity('bob-pass');
  const chatId = '11111111-2222-4333-8444-555555555555';
  const plaintext = 'Привет, это секретное сообщение';

  const encrypted = await encryptDirectMessage({
    plaintext,
    myPrivateKey: alice.privateKey,
    peerPublicKeyB64: publicKeyToBase64(bob.publicKey),
    chatId,
    keyVersion: 1,
  });

  assert.ok(encrypted.ciphertext);
  assert.ok(encrypted.nonce);
  assert.equal(encrypted.algorithm, 'x25519-aes256gcm-v1');

  const fromBob = await decryptDirectMessage({
    ciphertextB64: encrypted.ciphertext,
    nonceB64: encrypted.nonce,
    myPrivateKey: bob.privateKey,
    peerPublicKeyB64: publicKeyToBase64(alice.publicKey),
    chatId,
  });
  assert.equal(fromBob, plaintext);

  const fromAlice = await decryptDirectMessage({
    ciphertextB64: encrypted.ciphertext,
    nonceB64: encrypted.nonce,
    myPrivateKey: alice.privateKey,
    peerPublicKeyB64: publicKeyToBase64(bob.publicKey),
    chatId,
  });
  assert.equal(fromAlice, plaintext);
});
