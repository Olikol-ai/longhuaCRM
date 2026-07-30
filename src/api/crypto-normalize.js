function pick(obj, ...keys) {
  if (!obj || typeof obj !== 'object') return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

/** Normalize snake_case/camelCase crypto payloads from the API interceptor. */
export function normalizeCryptoMe(raw) {
  if (!raw) return { configured: false, needsSetup: true };
  const publicKey = pick(raw, 'publicKey', 'public_key') || null;
  const configured =
    raw.configured !== undefined ? Boolean(raw.configured) : Boolean(publicKey);
  const kdf = pick(raw, 'kdf') || null;
  return {
    configured,
    needsSetup: Boolean(raw.needsSetup ?? raw.needs_setup) || !configured,
    needsActivation: Boolean(
      pick(raw, 'needsActivation', 'needs_activation') || kdf === 'server-hold-v1',
    ),
    userId: pick(raw, 'userId', 'user_id') || null,
    publicKey,
    wrappedPrivateKey: pick(raw, 'wrappedPrivateKey', 'wrapped_private_key') || null,
    wrapSalt: pick(raw, 'wrapSalt', 'wrap_salt') || null,
    wrapIv: pick(raw, 'wrapIv', 'wrap_iv') || null,
    algorithm: pick(raw, 'algorithm') || null,
    kdf,
    kdfIterations: pick(raw, 'kdfIterations', 'kdf_iterations') || null,
    keyVersion: pick(raw, 'keyVersion', 'key_version') || 1,
    createdAt: pick(raw, 'createdAt', 'created_at') || null,
    updatedAt: pick(raw, 'updatedAt', 'updated_at') || null,
  };
}

export function normalizePublicKey(raw) {
  if (!raw) return null;
  return {
    userId: pick(raw, 'userId', 'user_id'),
    publicKey: pick(raw, 'publicKey', 'public_key'),
    algorithm: pick(raw, 'algorithm'),
    keyVersion: pick(raw, 'keyVersion', 'key_version') || 1,
  };
}
