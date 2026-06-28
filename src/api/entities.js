import entityNames from '../../shared/entity-names.json';
import { apiFetch } from './http';

function createEntityClient(entityName) {
  return {
    list(sortField, limit) {
      const params = new URLSearchParams();
      if (sortField) params.set('sort', sortField);
      if (limit) params.set('limit', String(limit));
      const qs = params.toString();
      return apiFetch(`/entities/${entityName}${qs ? `?${qs}` : ''}`);
    },
    filter(query) {
      return apiFetch(`/entities/${entityName}/filter`, {
        method: 'POST',
        body: JSON.stringify(query),
      });
    },
    create(data) {
      return apiFetch(`/entities/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    },
    update(id, data) {
      return apiFetch(`/entities/${entityName}/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
    },
    delete(id) {
      return apiFetch(`/entities/${entityName}/${id}`, { method: 'DELETE' });
    },
    bulkCreate(items) {
      return apiFetch(`/entities/${entityName}`, {
        method: 'POST',
        body: JSON.stringify(items),
      });
    },
  };
}

const CRM_ENTITY_NAMES = entityNames;
/** ShopSettings is the API name for shop catalog items (ShopItemEntity / shop_items). */
const ENTITY_NAMES = [...CRM_ENTITY_NAMES, 'User'];

const entities = {};
for (const name of ENTITY_NAMES) {
  if (name === 'User') {
    entities.User = {
      list() {
        return apiFetch('/users');
      },
      filter() {
        return apiFetch('/users');
      },
      update(id, data) {
        return apiFetch(`/users/${id}`, {
          method: 'PATCH',
          body: JSON.stringify(data),
        });
      },
      delete(id) {
        return apiFetch(`/users/${id}`, { method: 'DELETE' });
      },
      create() {
        return Promise.reject(new Error('Use /auth/register for User creation'));
      },
      bulkCreate() {
        return Promise.reject(new Error('Use /auth/register for User creation'));
      },
    };
  } else {
    entities[name] = createEntityClient(name);
  }
}

export { entities };
