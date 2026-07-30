/**
 * Direct message encrypt/decrypt via static ECDH + HKDF + AES-256-GCM.
 */

import { x25519 } from '@noble/curves/ed25519';
import {
  E2EE_ALGORITHM,
  E2EE_MESSAGE_INFO,
  base64ToBytes,
  bytesToBase64,
  publicKeyFromBase64,
} from './keys.js';

async function deriveConversationKey(sharedSecret, chatId) {
  const enc = new TextEncoder();
  const ikm = await crypto.subtle.importKey('raw', sharedSecret, 'HKDF', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: enc.encode(String(chatId)),
      info: enc.encode(E2EE_MESSAGE_INFO),
    },
    ikm,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

function ecdhShared(privateKeyBytes, peerPublicKeyBytes) {
  return x25519.getSharedSecret(privateKeyBytes, peerPublicKeyBytes);
}

/**
 * Encrypt plaintext for a Direct chat.
 * Both participants derive the same conversation key from ECDH(identity keys).
 */
export async function encryptDirectMessage({
  plaintext,
  myPrivateKey,
  peerPublicKeyB64,
  chatId,
  keyVersion = 1,
}) {
  const peerPub = typeof peerPublicKeyB64 === 'string'
    ? publicKeyFromBase64(peerPublicKeyB64)
    : peerPublicKeyB64;
  const shared = ecdhShared(myPrivateKey, peerPub);
  const aesKey = await deriveConversationKey(shared, chatId);
  const nonce = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce },
      aesKey,
      new TextEncoder().encode(plaintext),
    ),
  );
  return {
    ciphertext: bytesToBase64(ciphertext),
    nonce: bytesToBase64(nonce),
    algorithm: E2EE_ALGORITHM,
    keyVersion,
  };
}

export async function decryptDirectMessage({
  ciphertextB64,
  nonceB64,
  myPrivateKey,
  peerPublicKeyB64,
  chatId,
}) {
  const peerPub = typeof peerPublicKeyB64 === 'string'
    ? publicKeyFromBase64(peerPublicKeyB64)
    : peerPublicKeyB64;
  const shared = ecdhShared(myPrivateKey, peerPub);
  const aesKey = await deriveConversationKey(shared, chatId);
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(nonceB64) },
    aesKey,
    base64ToBytes(ciphertextB64),
  );
  return new TextDecoder().decode(plaintext);
}
