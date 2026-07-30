import { apiFetch } from './http';
import { normalizeCryptoMe, normalizePublicKey } from './crypto-normalize';

export { normalizeCryptoMe, normalizePublicKey } from './crypto-normalize';

export const cryptoApi = {
  me: async () => normalizeCryptoMe(await apiFetch('/crypto/me')),
  upsertMe: async (payload) =>
    normalizeCryptoMe(
      await apiFetch('/crypto/me', {
        method: 'PUT',
        body: JSON.stringify(payload),
      }),
    ),
  activateMe: async (password) =>
    normalizeCryptoMe(
      await apiFetch('/crypto/me/activate', {
        method: 'POST',
        body: JSON.stringify({ password }),
      }),
    ),
  publicKey: async (userId) => normalizePublicKey(await apiFetch(`/crypto/users/${userId}/public`)),
};
