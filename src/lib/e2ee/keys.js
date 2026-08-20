/**
 * Longhua Direct-chat E2EE — X25519 identity keys + password-wrapped private key.
 * Uses @noble/curves for X25519 and Web Crypto for PBKDF2 / AES-GCM.
 */

import { x25519 } from '@noble/curves/ed25519';

export const E2EE_ALGORITHM = 'x25519-aes256gcm-v1';
export const E2EE_KDF = 'pbkdf2-sha256';
export const E2EE_KDF_ITERATIONS = 310000;
export const E2EE_MESSAGE_INFO = 'longhua-dm-v1';

function bytesToBase64(bytes) {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

async function deriveWrapKey(password, saltBytes, iterations = E2EE_KDF_ITERATIONS) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

export function generateIdentityKeyPair() {
  const privateKey = x25519.utils.randomPrivateKey();
  const publicKey = x25519.getPublicKey(privateKey);
  return { privateKey, publicKey };
}

/**
 * Wrap private key with password for server-side backup (never plaintext).
 */
export async function wrapPrivateKey(privateKeyBytes, password, iterations = E2EE_KDF_ITERATIONS) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveWrapKey(password, salt, iterations);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, privateKeyBytes),
  );
  return {
    wrappedPrivateKey: bytesToBase64(ciphertext),
    wrapSalt: bytesToBase64(salt),
    wrapIv: bytesToBase64(iv),
    kdf: E2EE_KDF,
    kdfIterations: iterations,
    algorithm: E2EE_ALGORITHM,
  };
}

export async function unwrapPrivateKey(
  wrappedPrivateKeyB64,
  wrapSaltB64,
  wrapIvB64,
  password,
  iterations = E2EE_KDF_ITERATIONS,
) {
  const salt = base64ToBytes(wrapSaltB64);
  const iv = base64ToBytes(wrapIvB64);
  const ciphertext = base64ToBytes(wrappedPrivateKeyB64);
  const key = await deriveWrapKey(password, salt, iterations);
  try {
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new Uint8Array(raw);
  } catch {
    throw new Error('Неверный пароль или повреждённый ключ шифрования');
  }
}

export function publicKeyToBase64(publicKeyBytes) {
  return bytesToBase64(publicKeyBytes);
}

export function privateKeyToBase64(privateKeyBytes) {
  return bytesToBase64(privateKeyBytes);
}

export function publicKeyFromBase64(b64) {
  return base64ToBytes(b64);
}

export function privateKeyFromBase64(b64) {
  return base64ToBytes(b64);
}

export async function createAndWrapIdentity(password) {
  const { privateKey, publicKey } = generateIdentityKeyPair();
  const wrapped = await wrapPrivateKey(privateKey, password);
  return {
    privateKey,
    publicKey,
    publicKeyB64: publicKeyToBase64(publicKey),
    ...wrapped,
    keyVersion: 1,
  };
}

/**
 * Re-wrap the same private identity key with a new password.
 * Does not generate a new keypair.
 */
export async function rewrapPrivateKeyWithNewPassword(
  privateKeyBytes,
  newPassword,
  iterations = E2EE_KDF_ITERATIONS,
) {
  return wrapPrivateKey(privateKeyBytes, newPassword, iterations);
}

/**
 * Unwrap with the old password, wrap with the new one, keep the same bytes.
 */
export async function rewrapWrappedPrivateKey({
  wrappedPrivateKey,
  wrapSalt,
  wrapIv,
  oldPassword,
  newPassword,
  iterations = E2EE_KDF_ITERATIONS,
}) {
  const privateKey = await unwrapPrivateKey(
    wrappedPrivateKey,
    wrapSalt,
    wrapIv,
    oldPassword,
    iterations,
  );
  const wrapped = await wrapPrivateKey(privateKey, newPassword, iterations);
  return { privateKey, ...wrapped };
}

export { bytesToBase64, base64ToBytes };
