import { apiFetch } from './http';

export const cryptoApi = {
  me: () => apiFetch('/crypto/me'),
  upsertMe: (payload) =>
    apiFetch('/crypto/me', {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),
  publicKey: (userId) => apiFetch(`/crypto/users/${userId}/public`),
};
