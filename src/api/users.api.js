import { apiFetch } from './http';
import { recordToEntityPayload } from './domain-client';

export const users = {
  list() {
    return apiFetch('/users');
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
};
