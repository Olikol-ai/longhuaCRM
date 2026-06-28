const API_BASE = '/api';
export const TOKEN_KEY = 'longhua_access_token';
const TOKEN_CHANGE_EVENT = 'longhua:token-change';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  const hadToken = Boolean(localStorage.getItem(TOKEN_KEY));
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
  const hasToken = Boolean(token);
  if (hadToken !== hasToken && typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(TOKEN_CHANGE_EVENT));
  }
}

export function onTokenChange(listener) {
  if (typeof window === 'undefined') {
    return () => {};
  }
  const handleStorage = (event) => {
    if (event.key !== null && event.key !== TOKEN_KEY) return;
    listener();
  };
  window.addEventListener('storage', handleStorage);
  window.addEventListener(TOKEN_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener('storage', handleStorage);
    window.removeEventListener(TOKEN_CHANGE_EVENT, listener);
  };
}

export async function apiFetch(path, options = {}) {
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
    const err = new Error(data.message || data.error || 'Request failed');
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

export async function apiUpload(file) {
  const formData = new FormData();
  formData.append('file', file);

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}/uploads`, { method: 'POST', headers, body: formData });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const err = new Error(data.message || data.error || 'Upload failed');
    err.status = res.status;
    throw err;
  }

  return data;
}
