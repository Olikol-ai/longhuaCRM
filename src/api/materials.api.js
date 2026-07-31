import { apiFetch } from './http';
import { createDomainClient, recordToEntityPayload, sortRecords } from './domain-client';

const materialsClient = createDomainClient('/materials');
const folders = createDomainClient('/materials/folders', {
  listPath: '/materials/folders',
  filterPath: '/materials/folders/filter',
});

/**
 * List materials. Optional courseId/folderId scopes the payload after ACL
 * (lazy load when browsing a course/folder).
 */
function listMaterials(sortField, limit, scope = {}) {
  const params = new URLSearchParams();
  if (scope.courseId) params.set('courseId', scope.courseId);
  if (scope.folderId) params.set('folderId', scope.folderId);
  const qs = params.toString();
  const path = qs ? `/materials?${qs}` : '/materials';
  return apiFetch(path).then((data) => {
    let rows = Array.isArray(data) ? data : [];
    rows = sortRecords(rows, sortField);
    if (limit) {
      rows = rows.slice(0, Number(limit));
    }
    return rows;
  });
}

export const materials = {
  ...materialsClient,
  list: listMaterials,
  folders,
  access: {
    sync(data) {
      return apiFetch('/materials/access/sync', {
        method: 'POST',
        body: JSON.stringify(recordToEntityPayload(data)),
      });
    },
    grant(data) {
      return apiFetch('/materials/access/grant', {
        method: 'POST',
        body: JSON.stringify(recordToEntityPayload(data)),
      });
    },
    revoke(data) {
      return apiFetch('/materials/access/revoke', {
        method: 'POST',
        body: JSON.stringify(recordToEntityPayload(data)),
      });
    },
    listForMaterial(materialId) {
      return apiFetch(`/materials/access/material/${materialId}`);
    },
  },
};
