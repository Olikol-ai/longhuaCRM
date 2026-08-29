import { apiFetch } from './http';

/** Live Admin Dashboard SSOT — no client cache. */
export const dashboard = {
  adminSummary() {
    return apiFetch('/dashboard/admin', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-store' },
    });
  },
};
