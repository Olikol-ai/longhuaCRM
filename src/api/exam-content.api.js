import { apiFetch } from './http';

function qs(filters = {}) {
  const q = new URLSearchParams();
  Object.entries(filters).forEach(([k, v]) => {
    if (v != null && v !== '' && v !== false) q.set(k, String(v));
  });
  const s = q.toString();
  return s ? `?${s}` : '';
}

export const examContent = {
  taxonomy: {
    programs: () => apiFetch('/exam-content/taxonomy/programs'),
    versions: (program) =>
      apiFetch(`/exam-content/taxonomy/versions${program ? `?program=${encodeURIComponent(program)}` : ''}`),
    levels: (version) =>
      apiFetch(`/exam-content/taxonomy/levels?version=${encodeURIComponent(version || '')}`),
    sections: (levelId) =>
      apiFetch(`/exam-content/taxonomy/sections?levelId=${encodeURIComponent(levelId || '')}`),
    topics: (versionId) =>
      apiFetch(`/exam-content/taxonomy/topics?versionId=${encodeURIComponent(versionId || '')}`),
  },
  itemTypes: {
    list: () => apiFetch('/exam-content/item-types'),
  },
  media: {
    list: (kind) => apiFetch(`/exam-content/media${kind ? `?kind=${encodeURIComponent(kind)}` : ''}`),
    register: (payload) =>
      apiFetch('/exam-content/media', { method: 'POST', body: JSON.stringify(payload) }),
    archive: (id) =>
      apiFetch(`/exam-content/media/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    linkItem: (assetId, payload) =>
      apiFetch(`/exam-content/media/${encodeURIComponent(assetId)}/link-item`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
    linkGroup: (assetId, payload) =>
      apiFetch(`/exam-content/media/${encodeURIComponent(assetId)}/link-group`, {
        method: 'POST',
        body: JSON.stringify(payload),
      }),
  },
  items: {
    list: (filters = {}) => apiFetch(`/exam-content/items${qs(filters)}`),
    get: (id) => apiFetch(`/exam-content/items/${encodeURIComponent(id)}`),
    create: (payload) =>
      apiFetch('/exam-content/items', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) =>
      apiFetch(`/exam-content/items/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    preview: (payload) =>
      apiFetch('/exam-content/items/preview', { method: 'POST', body: JSON.stringify(payload) }),
    submitReview: (id) =>
      apiFetch(`/exam-content/items/${encodeURIComponent(id)}/submit-review`, { method: 'POST' }),
    publish: (id) =>
      apiFetch(`/exam-content/items/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
    archive: (id) =>
      apiFetch(`/exam-content/items/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
    history: (id) => apiFetch(`/exam-content/items/${encodeURIComponent(id)}/history`),
    rollback: (id) =>
      apiFetch(`/exam-content/items/${encodeURIComponent(id)}/rollback`, { method: 'POST' }),
    stats: (id) => apiFetch(`/exam-content/items/${encodeURIComponent(id)}/stats`),
  },
  groups: {
    list: (filters = {}) => apiFetch(`/exam-content/groups${qs(filters)}`),
    get: (id) => apiFetch(`/exam-content/groups/${encodeURIComponent(id)}`),
    create: (payload) =>
      apiFetch('/exam-content/groups', { method: 'POST', body: JSON.stringify(payload) }),
    update: (id, payload) =>
      apiFetch(`/exam-content/groups/${encodeURIComponent(id)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    publish: (id) =>
      apiFetch(`/exam-content/groups/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
  },
  blueprints: {
    list: (levelId) =>
      apiFetch(`/exam-content/blueprints${levelId ? `?levelId=${encodeURIComponent(levelId)}` : ''}`),
    create: (payload) =>
      apiFetch('/exam-content/blueprints', { method: 'POST', body: JSON.stringify(payload) }),
    get: (id) => apiFetch(`/exam-content/blueprints/${encodeURIComponent(id)}`),
    editions: (id) => apiFetch(`/exam-content/blueprints/${encodeURIComponent(id)}/editions`),
  },
  editions: {
    structure: (id) => apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/structure`),
    saveStructure: (id, payload) =>
      apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/structure`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      }),
    submitReview: (id) =>
      apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/submit-review`, { method: 'POST' }),
    publish: (id) =>
      apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/publish`, { method: 'POST' }),
    archive: (id) =>
      apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/archive`, { method: 'POST' }),
    clone: (id) =>
      apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/clone`, { method: 'POST' }),
    history: (id) => apiFetch(`/exam-content/editions/${encodeURIComponent(id)}/history`),
  },
  generate: (payload) =>
    apiFetch('/exam-content/generate', { method: 'POST', body: JSON.stringify(payload) }),
  import: (payload) =>
    apiFetch('/exam-content/import', { method: 'POST', body: JSON.stringify(payload) }),
  export: (payload) =>
    apiFetch('/exam-content/export', { method: 'POST', body: JSON.stringify(payload) }),
  bulk: (payload) =>
    apiFetch('/exam-content/bulk', { method: 'POST', body: JSON.stringify(payload) }),
  recomputeStats: () =>
    apiFetch('/exam-content/stats/recompute', { method: 'POST' }),
};
