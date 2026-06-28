import { alfabank } from './alfabank';
import { auth } from './auth';
import { entities } from './entities';
import { functions } from './functions';
import { apiUpload } from './http';

export { getToken, setToken, apiFetch, TOKEN_KEY, onTokenChange } from './http';
export { alfabank } from './alfabank';
export { auth } from './auth';
export { entities } from './entities';
export { functions } from './functions';

/** Unified API client — all frontend requests go through /api/* */
export const api = {
  auth,
  alfabank,
  entities,
  functions,
  uploads: {
    async uploadFile({ file }) {
      const result = await apiUpload(file);
      return { file_url: result.url };
    },
  },
};
