import { auth } from './auth';
import { entities } from './entities';
import { functions } from './functions';
import { apiUpload } from './http';

export { getToken, setToken, apiFetch } from './http';
export { auth } from './auth';
export { entities } from './entities';
export { functions } from './functions';

/** Unified API client — all frontend requests go through /api/* */
export const api = {
  auth,
  entities,
  functions,
  uploads: {
    async uploadFile({ file }) {
      const result = await apiUpload(file);
      return { file_url: result.url };
    },
  },
};
