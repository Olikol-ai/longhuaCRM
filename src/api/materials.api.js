import { apiFetch } from './http';
import { createDomainClient, recordToEntityPayload } from './domain-client';

const materialsClient = createDomainClient('/materials');
const folders = createDomainClient('/materials/folders', {
  listPath: '/materials/folders',
  filterPath: '/materials/folders/filter',
});

export const materials = {
  ...materialsClient,
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
