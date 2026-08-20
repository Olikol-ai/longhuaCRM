import {
  assertOnlineForMutation,
  isMutationMethod,
  noteFetchFailure,
  OfflineMutationError,
} from '@/lib/offline/offlineGuard';
import { markNetworkOnline } from '@/lib/offline/offlineStatus';

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
  const method = options.method || 'GET';
  if (isMutationMethod(method)) {
    assertOnlineForMutation();
  }

  const headers = { 'Content-Type': 'application/json', ...options.headers };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  } catch (err) {
    noteFetchFailure(err);
    throw err;
  }

  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(extractApiErrorMessage(data));
    err.status = res.status;
    err.data = data;
    err.retryAfter = data.retryAfter;
    throw err;
  }
  markNetworkOnline();
  return data;
}

function extractApiErrorMessage(data) {
  const msg = data?.message;
  if (Array.isArray(msg)) {
    return msg.filter(Boolean).join(', ') || 'Не удалось выполнить запрос. Попробуйте ещё раз.';
  }
  if (typeof msg === 'string' && msg.trim()) {
    return msg;
  }
  if (msg && typeof msg === 'object') {
    if (typeof msg.message === 'string' && msg.message.trim()) {
      return msg.message;
    }
  }
  if (typeof data?.error === 'string' && data.error.trim()) {
    return data.error;
  }
  return 'Не удалось выполнить запрос. Попробуйте ещё раз.';
}

export async function apiUploadTo(path, file, fieldName = 'file', options = {}) {
  assertOnlineForMutation();
  const { onProgress, signal } = options;

  // XHR: progress + abort for large materials uploads.
  if (typeof onProgress === 'function' || signal) {
    return uploadWithXhr(path, file, fieldName, { onProgress, signal });
  }

  const formData = new FormData();
  formData.append(fieldName, file);

  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, { method: 'POST', headers, body: formData });
  } catch (err) {
    noteFetchFailure(err);
    throw err;
  }
  const text = await res.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const payload = typeof data.message === 'object' && data.message !== null ? data.message : data;
    const message = Array.isArray(payload.message)
      ? payload.message.join(', ')
      : payload.message || data.error || 'Не удалось загрузить файл. Попробуйте ещё раз.';
    const err = new Error(message);
    err.status = res.status;
    err.data = payload;
    throw err;
  }

  markNetworkOnline();
  return data;
}

function uploadWithXhr(path, file, fieldName, { onProgress, signal } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append(fieldName, file);

    const startedAt = Date.now();
    let lastLoaded = 0;
    let lastAt = startedAt;

    xhr.open('POST', `${API_BASE}${path}`);
    const token = getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || typeof onProgress !== 'function') return;
      const now = Date.now();
      const elapsedSec = Math.max(0.001, (now - lastAt) / 1000);
      const delta = Math.max(0, event.loaded - lastLoaded);
      const instantSpeed = delta / elapsedSec;
      const overallElapsed = Math.max(0.001, (now - startedAt) / 1000);
      const averageSpeed = event.loaded / overallElapsed;
      lastLoaded = event.loaded;
      lastAt = now;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        percent: event.total > 0 ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : 0,
        bytesPerSecond: instantSpeed || averageSpeed,
      });
    };

    xhr.onload = () => {
      let data = {};
      try {
        data = xhr.responseText ? JSON.parse(xhr.responseText) : {};
      } catch {
        data = { raw: xhr.responseText };
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        markNetworkOnline();
        resolve(data);
        return;
      }
      const payload = typeof data.message === 'object' && data.message !== null ? data.message : data;
      const message = Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message || data.error || 'Не удалось загрузить файл. Попробуйте ещё раз.';
      const err = new Error(message);
      err.status = xhr.status;
      err.data = payload;
      reject(err);
    };

    xhr.onerror = () => {
      const err = new Error('Сеть недоступна. Проверьте соединение и попробуйте ещё раз.');
      noteFetchFailure(err);
      reject(err);
    };

    xhr.onabort = () => {
      const err = new Error('Загрузка отменена');
      err.status = 0;
      err.aborted = true;
      reject(err);
    };

    if (signal) {
      if (signal.aborted) {
        xhr.abort();
        return;
      }
      signal.addEventListener('abort', () => xhr.abort(), { once: true });
    }

    xhr.send(formData);
  });
}

export async function apiUpload(file, options = {}) {
  return apiUploadTo('/files/upload', file, 'file', options);
}

/** Authenticated avatar URL for <img> (Bearer cannot be sent by the browser on image requests). */
export function buildUserAvatarUrl(userId, { thumb = true, version = null } = {}) {
  if (!userId) return null;
  const params = new URLSearchParams();
  if (thumb) params.set('thumb', '1');
  if (version) params.set('v', String(version));
  const token = getToken();
  if (token) params.set('access_token', token);
  const qs = params.toString();
  return `${API_BASE}/users/${userId}/avatar${qs ? `?${qs}` : ''}`;
}
