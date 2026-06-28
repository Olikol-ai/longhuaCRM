import { apiFetch } from './http';

export const functions = {
  async invoke(name, params = {}) {
    const data = await apiFetch(`/functions/${name}`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
    return { data };
  },
};
