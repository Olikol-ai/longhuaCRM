import { apiFetch, apiUploadTo } from './http';
import { recordToEntityPayload } from './domain-client';

function withQuery(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value != null && value !== '') search.set(key, String(value));
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const users = {
  list() {
    return apiFetch('/users');
  },

  directory() {
    return apiFetch('/users/directory');
  },

  registry(params = {}) {
    return apiFetch(withQuery('/users/registry', params));
  },

  get(id) {
    return apiFetch(`/users/${id}`);
  },

  filter() {
    return this.list();
  },

  update(id, data) {
    return apiFetch(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(recordToEntityPayload(data)),
    });
  },

  delete(id) {
    return apiFetch(`/users/${id}`, { method: 'DELETE' });
  },

  deletePendingRegistration(id) {
    return apiFetch(`/users/pending-registrations/${id}`, { method: 'DELETE' });
  },

  create() {
    return Promise.reject(new Error('Use /auth/register for user creation'));
  },

  avatar: {
    upload({ file, userId } = {}) {
      if (!file) {
        return Promise.reject(new Error('Файл обязателен'));
      }
      const path = userId ? `/users/${userId}/avatar` : '/users/me/avatar';
      return apiUploadTo(path, file);
    },

    remove({ userId } = {}) {
      const path = userId ? `/users/${userId}/avatar` : '/users/me/avatar';
      return apiFetch(path, { method: 'DELETE' });
    },
  },
};
