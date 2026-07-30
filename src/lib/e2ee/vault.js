/**
 * In-memory E2EE vault for the current browser tab.
 * Private key never goes to sessionStorage/localStorage in plaintext.
 */

/** @type {{ status: 'missing'|'locked'|'ready', privateKey: Uint8Array|null, publicKeyB64: string|null, keyVersion: number, peerCache: Map<string, { publicKey: string, keyVersion: number }> }} */
const state = {
  status: 'missing',
  privateKey: null,
  publicKeyB64: null,
  keyVersion: 1,
  peerCache: new Map(),
};

export function getE2eeStatus() {
  return state.status;
}

export function getMyPublicKeyB64() {
  return state.publicKeyB64;
}

export function getMyKeyVersion() {
  return state.keyVersion;
}

export function getMyPrivateKey() {
  return state.privateKey;
}

export function isE2eeReady() {
  return state.status === 'ready' && Boolean(state.privateKey);
}

export function lockE2eeVault() {
  state.privateKey = null;
  state.status = state.publicKeyB64 ? 'locked' : 'missing';
}

export function setE2eeReady({ privateKey, publicKeyB64, keyVersion = 1 }) {
  state.privateKey = privateKey;
  state.publicKeyB64 = publicKeyB64;
  state.keyVersion = keyVersion;
  state.status = 'ready';
}

export function setE2eeLockedFromServer({ publicKeyB64, keyVersion = 1 }) {
  state.privateKey = null;
  state.publicKeyB64 = publicKeyB64 || null;
  state.keyVersion = keyVersion;
  state.status = publicKeyB64 ? 'locked' : 'missing';
}

export function setE2eeMissing() {
  state.privateKey = null;
  state.publicKeyB64 = null;
  state.keyVersion = 1;
  state.status = 'missing';
  state.peerCache.clear();
}

export function cachePeerKey(userId, publicKey, keyVersion = 1) {
  if (!userId || !publicKey) return;
  state.peerCache.set(userId, { publicKey, keyVersion });
}

export function getCachedPeerKey(userId) {
  return state.peerCache.get(userId) || null;
}

export function clearPeerCache() {
  state.peerCache.clear();
}
