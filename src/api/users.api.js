import { apiFetch, apiUploadTo } from './http';
import { recordToEntityPayload } from './domain-client';

export const users = {
  list() {
    return apiFetch('/users');
  },

  directory() {
    return apiFetch('/users/directory');
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
