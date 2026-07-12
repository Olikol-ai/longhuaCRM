import { apiFetch } from './http';

export const settings = {
  list() {
    return apiFetch('/settings');
  },

  async filter(query) {
    const rows = await this.list();
    if (!query || Object.keys(query).length === 0) {
      return rows;
    }

    return rows.filter((row) =>
      Object.entries(query).every(([key, value]) => row[key] == value),
    );
  },

  create(data) {
    if (!data?.key) {
      return Promise.reject(new Error('Setting key is required'));
    }

    return apiFetch(`/settings/${encodeURIComponent(data.key)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        value: data.value,
        description: data.description,
      }),
    });
  },

  update(_id, data) {
    const key = data?.key;
    if (!key) {
      return Promise.reject(new Error('Setting key is required'));
    }

    return apiFetch(`/settings/${encodeURIComponent(key)}`, {
      method: 'PATCH',
      body: JSON.stringify({
        value: data.value,
        description: data.description,
      }),
    });
  },

  delete() {
    return Promise.reject(new Error('Settings delete is not supported by the domain API'));
  },

  welcome: {
    async list() {
      const record = await apiFetch('/settings/welcome/page');
      return Object.keys(record).length > 1 ? [record] : [];
    },

    async filter() {
      return this.list();
    },

    create(data) {
      return apiFetch('/settings/welcome/page', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    update(_id, data) {
      return apiFetch('/settings/welcome/page', {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },

    delete() {
      return Promise.reject(new Error('Welcome page delete is not supported'));
    },
  },
};
