const API_BASE = '/api';
const TOKEN_KEY = 'longhua_access_token';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

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

const ENTITY_NAMES = [
  'Student', 'Teacher', 'Lesson', 'Payment', 'Course',
  'LessonMaterial', 'ScheduleSlot', 'LessonStudent',
  'LessonBalance', 'TeacherPayment', 'MaterialAccess',
  'TeacherAvailability', 'AlfaBankOrder', 'AppSettings',
  'ShopSettings', 'WelcomePageSettings', 'User',
];

const entities = {};
for (const name of ENTITY_NAMES) {
  entities[name] = createEntityClient(name);
}

export const base44 = {
  auth: {
    async me() {
      if (!getToken()) {
        const err = new Error('Not authenticated');
        err.status = 401;
        throw err;
      }
      return apiFetch('/auth/me');
    },
    async updateMe(data) {
      return apiFetch('/auth/me', { method: 'PATCH', body: JSON.stringify(data) });
    },
    logout(redirectUrl) {
      setToken(null);
      if (redirectUrl !== undefined) {
        window.location.href = '/login';
      }
    },
    redirectToLogin(redirectUrl) {
      const returnUrl = redirectUrl || window.location.href;
      window.location.href = `/login?from_url=${encodeURIComponent(returnUrl)}`;
    },
    async login(email, password) {
      const result = await apiFetch('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(result.token);
      return result.user;
    },
    async register(email, password, firstName, lastName) {
      const result = await apiFetch('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
          first_name: firstName,
          last_name: lastName,
        }),
      });
      setToken(result.token);
      return result.user;
    },
  },
  entities,
  functions: {
    async invoke(name, params = {}) {
      const data = await apiFetch(`/functions/${name}`, {
        method: 'POST',
        body: JSON.stringify(params),
      });
      return { data };
    },
  },
};
