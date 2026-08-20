import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createAndWrapIdentity,
  publicKeyToBase64,
  rewrapPrivateKeyWithNewPassword,
  rewrapWrappedPrivateKey,
  unwrapPrivateKey,
} from './keys.js';
import { encryptDirectMessage, decryptDirectMessage } from './message.js';

const OLD_PASSWORD = 'Old-Pass-123';
const NEW_PASSWORD = 'New-Pass-456';

test('password change rewraps the same identity key', async () => {
  const identity = await createAndWrapIdentity(OLD_PASSWORD);
  const publicBefore = publicKeyToBase64(identity.publicKey);
  const restored = await rewrapWrappedPrivateKey({
    wrappedPrivateKey: identity.wrappedPrivateKey,
    wrapSalt: identity.wrapSalt,
    wrapIv: identity.wrapIv,
    oldPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
    iterations: identity.kdfIterations,
  });
  assert.deepEqual([...restored.privateKey], [...identity.privateKey]);
  assert.equal(publicKeyToBase64(identity.publicKey), publicBefore);

  const unlocked = await unwrapPrivateKey(
    restored.wrappedPrivateKey,
    restored.wrapSalt,
    restored.wrapIv,
    NEW_PASSWORD,
    restored.kdfIterations,
  );
  assert.deepEqual([...unlocked], [...identity.privateKey]);
});

test('after password change old wrap password is rejected and new unlocks', async () => {
  const identity = await createAndWrapIdentity(OLD_PASSWORD);
  const restored = await rewrapWrappedPrivateKey({
    wrappedPrivateKey: identity.wrappedPrivateKey,
    wrapSalt: identity.wrapSalt,
    wrapIv: identity.wrapIv,
    oldPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
    iterations: identity.kdfIterations,
  });
  await assert.rejects(
    () =>
      unwrapPrivateKey(
        restored.wrappedPrivateKey,
        restored.wrapSalt,
        restored.wrapIv,
        OLD_PASSWORD,
        restored.kdfIterations,
      ),
    /пароль|ключ/i,
  );
  const again = await unwrapPrivateKey(
    restored.wrappedPrivateKey,
    restored.wrapSalt,
    restored.wrapIv,
    NEW_PASSWORD,
    restored.kdfIterations,
  );
  assert.deepEqual([...again], [...identity.privateKey]);
});

test('wrong password is still rejected after rewrap helpers exist', async () => {
  const identity = await createAndWrapIdentity(OLD_PASSWORD);
  await assert.rejects(
    () =>
      unwrapPrivateKey(
        identity.wrappedPrivateKey,
        identity.wrapSalt,
        identity.wrapIv,
        'not-the-password',
        identity.kdfIterations,
      ),
    /пароль|ключ/i,
  );
});

test('corrupted key material is rejected', async () => {
  const identity = await createAndWrapIdentity(OLD_PASSWORD);
  const broken = `AAAA${identity.wrappedPrivateKey.slice(4)}`;
  await assert.rejects(
    () =>
      unwrapPrivateKey(
        broken,
        identity.wrapSalt,
        identity.wrapIv,
        OLD_PASSWORD,
        identity.kdfIterations,
      ),
    /пароль|ключ/i,
  );
});

test('password change does not rotate identity — DM still decrypts', async () => {
  const alice = await createAndWrapIdentity(OLD_PASSWORD);
  const bob = await createAndWrapIdentity('Bob-Pass-789');
  const chatId = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  const plaintext = 'секретное сообщение после смены пароля';
  const encrypted = await encryptDirectMessage({
    plaintext,
    myPrivateKey: alice.privateKey,
    peerPublicKeyB64: publicKeyToBase64(bob.publicKey),
    chatId,
    keyVersion: 1,
  });

  const rewrapped = await rewrapPrivateKeyWithNewPassword(
    alice.privateKey,
    NEW_PASSWORD,
    alice.kdfIterations,
  );
  const aliceAgain = await unwrapPrivateKey(
    rewrapped.wrappedPrivateKey,
    rewrapped.wrapSalt,
    rewrapped.wrapIv,
    NEW_PASSWORD,
    rewrapped.kdfIterations,
  );
  assert.deepEqual([...aliceAgain], [...alice.privateKey]);

  const decrypted = await decryptDirectMessage({
    ciphertextB64: encrypted.ciphertext,
    nonceB64: encrypted.nonce,
    myPrivateKey: aliceAgain,
    peerPublicKeyB64: publicKeyToBase64(bob.publicKey),
    chatId,
  });
  assert.equal(decrypted, plaintext);

  const attachment = await encryptDirectMessage({
    plaintext: 'voice-bytes-placeholder',
    myPrivateKey: aliceAgain,
    peerPublicKeyB64: publicKeyToBase64(bob.publicKey),
    chatId,
    keyVersion: 1,
  });
  const attachmentPlain = await decryptDirectMessage({
    ciphertextB64: attachment.ciphertext,
    nonceB64: attachment.nonce,
    myPrivateKey: bob.privateKey,
    peerPublicKeyB64: publicKeyToBase64(alice.publicKey),
    chatId,
  });
  assert.equal(attachmentPlain, 'voice-bytes-placeholder');
});

test('multi-device: two unwraps of rewrapped material yield the same key', async () => {
  const identity = await createAndWrapIdentity(OLD_PASSWORD);
  const restored = await rewrapWrappedPrivateKey({
    wrappedPrivateKey: identity.wrappedPrivateKey,
    wrapSalt: identity.wrapSalt,
    wrapIv: identity.wrapIv,
    oldPassword: OLD_PASSWORD,
    newPassword: NEW_PASSWORD,
    iterations: identity.kdfIterations,
  });
  const deviceA = await unwrapPrivateKey(
    restored.wrappedPrivateKey,
    restored.wrapSalt,
    restored.wrapIv,
    NEW_PASSWORD,
    restored.kdfIterations,
  );
  const deviceB = await unwrapPrivateKey(
    restored.wrappedPrivateKey,
    restored.wrapSalt,
    restored.wrapIv,
    NEW_PASSWORD,
    restored.kdfIterations,
  );
  assert.deepEqual([...deviceA], [...deviceB]);
  assert.deepEqual([...deviceA], [...identity.privateKey]);
});
