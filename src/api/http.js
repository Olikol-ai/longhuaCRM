import {
  assertOnlineForMutation,
  isMutationMethod,
  noteFetchFailure,
} from '@/lib/offline/offlineGuard';
import { markNetworkOnline } from '@/lib/offline/offlineStatus';

const API_BASE = '/api';
export const TOKEN_KEY = 'longhua_access_token';
const TOKEN_CHANGE_EVENT = 'longhua:token-change';

/** Cloudflare Free/Pro roughly caps a single proxied body near 100 MB — stay under. */
export const MATERIALS_UPLOAD_CHUNK_BYTES = 40 * 1024 * 1024;
/** Use chunked protocol for anything that risks the Cloudflare body limit. */
export const MATERIALS_UPLOAD_CHUNK_THRESHOLD_BYTES = 50 * 1024 * 1024;

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

function mapUploadHttpError(status, fallbackMessage) {
  if (status === 413) {
    return 'Файл слишком большой для инфраструктуры (лимит прокси/сервера). Попробуйте ещё раз или уменьшите файл.';
  }
  if (status === 408 || status === 499) {
    return 'Соединение прервалось или истекло время ожидания. Повторите загрузку.';
  }
  if (status === 502 || status === 504) {
    return 'Сервер временно недоступен (ошибка шлюза). Повторите загрузку через минуту.';
  }
  if (status >= 500) {
    return 'Ошибка сервера при загрузке файла. Повторите попытку.';
  }
  return fallbackMessage || 'Не удалось загрузить файл. Попробуйте ещё раз.';
}

function emitProgress(onProgress, patch) {
  if (typeof onProgress !== 'function') return;
  onProgress(patch);
}

export async function apiUploadTo(path, file, fieldName = 'file', options = {}) {
  assertOnlineForMutation();
  const { onProgress, signal } = options;

  if (
    path === '/files/upload' &&
    file &&
    Number(file.size) > MATERIALS_UPLOAD_CHUNK_THRESHOLD_BYTES
  ) {
    return uploadMaterialChunked(file, { onProgress, signal });
  }

  return uploadWithXhr(path, file, fieldName, { onProgress, signal });
}

/**
 * Chunked materials upload: init → N× chunk → complete.
 * Each chunk stays under Cloudflare's proxied body limit.
 */
async function uploadMaterialChunked(file, { onProgress, signal } = {}) {
  assertOnlineForMutation();
  const total = Number(file.size) || 0;
  emitProgress(onProgress, {
    phase: 'uploading',
    loaded: 0,
    total,
    percent: 0,
    bytesPerSecond: 0,
  });

  const init = await apiFetch('/files/upload/init', {
    method: 'POST',
    body: JSON.stringify({
      originalName: file.name,
      sizeBytes: total,
      mimeType: file.type || undefined,
    }),
  });

  const uploadId = init.upload_id;
  const chunkSize = Number(init.chunk_size_bytes) || MATERIALS_UPLOAD_CHUNK_BYTES;
  const totalChunks = Number(init.total_chunks) || Math.ceil(total / chunkSize);
  let uploadedBytes = 0;
  const startedAt = Date.now();

  const abortSession = async () => {
    try {
      await apiFetch('/files/upload/abort', {
        method: 'POST',
        body: JSON.stringify({ uploadId }),
      });
    } catch {
      // best-effort cleanup
    }
  };

  if (signal?.aborted) {
    await abortSession();
    const err = new Error('Загрузка отменена');
    err.status = 0;
    err.aborted = true;
    throw err;
  }

  const onAbort = () => {
    void abortSession();
  };
  signal?.addEventListener?.('abort', onAbort, { once: true });

  try {
    for (let index = 0; index < totalChunks; index += 1) {
      if (signal?.aborted) {
        const err = new Error('Загрузка отменена');
        err.status = 0;
        err.aborted = true;
        throw err;
      }
      const start = index * chunkSize;
      const end = Math.min(total, start + chunkSize);
      const blob = file.slice(start, end);

      await uploadWithXhr('/files/upload/chunk', blob, 'file', {
        signal,
        extraFields: {
          uploadId,
          chunkIndex: String(index),
        },
        onProgress: (chunkProgress) => {
          const loaded = uploadedBytes + (chunkProgress.loaded || 0);
          const overallElapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
          emitProgress(onProgress, {
            phase: 'uploading',
            loaded: Math.min(total, loaded),
            total,
            percent: total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0,
            bytesPerSecond: loaded / overallElapsed,
          });
        },
        timeoutMs: Math.max(10 * 60 * 1000, (end - start) * 40),
      });
      uploadedBytes = end;
      const overallElapsed = Math.max(0.001, (Date.now() - startedAt) / 1000);
      emitProgress(onProgress, {
        phase: 'uploading',
        loaded: uploadedBytes,
        total,
        percent: total > 0 ? Math.min(99, Math.round((uploadedBytes / total) * 100)) : 0,
        bytesPerSecond: uploadedBytes / overallElapsed,
      });
    }

    emitProgress(onProgress, {
      phase: 'processing',
      loaded: total,
      total,
      percent: 100,
      bytesPerSecond: 0,
    });

    // Assemble of multi-GB files is streaming but can take minutes — keep upload-scoped timeout.
    const result = await apiFetch('/files/upload/complete', {
      method: 'POST',
      body: JSON.stringify({ uploadId }),
      signal,
      // Note: apiFetch passes signal through; browsers do not enforce a default short timeout.
    });

    emitProgress(onProgress, {
      phase: 'success',
      loaded: total,
      total,
      percent: 100,
      bytesPerSecond: 0,
    });
    return result;
  } catch (err) {
    if (!err?.aborted) {
      await abortSession();
    }
    emitProgress(onProgress, {
      phase: 'error',
      loaded: uploadedBytes,
      total,
      percent: total > 0 ? Math.min(99, Math.round((uploadedBytes / total) * 100)) : 0,
      bytesPerSecond: 0,
    });
    throw err;
  } finally {
    signal?.removeEventListener?.('abort', onAbort);
  }
}

function uploadWithXhr(path, fileOrBlob, fieldName, options = {}) {
  const { onProgress, signal, extraFields = null, timeoutMs = 0 } = options;
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    if (extraFields && typeof extraFields === 'object') {
      for (const [key, value] of Object.entries(extraFields)) {
        formData.append(key, value);
      }
    }
    // Preserve filename for File; Blob chunks use a generic name.
    if (typeof File !== 'undefined' && fileOrBlob instanceof File) {
      formData.append(fieldName, fileOrBlob);
    } else {
      formData.append(fieldName, fileOrBlob, 'chunk.bin');
    }

    const startedAt = Date.now();
    let lastLoaded = 0;
    let lastAt = startedAt;
    let reachedBodyEnd = false;

    xhr.open('POST', `${API_BASE}${path}`);
    const token = getToken();
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    // 0 = no browser-imposed timeout (large uploads may take tens of minutes).
    xhr.timeout = Number(timeoutMs) > 0 ? Number(timeoutMs) : 0;

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
      const percent =
        event.total > 0 ? Math.min(100, Math.round((event.loaded / event.total) * 100)) : 0;
      if (percent >= 100) {
        reachedBodyEnd = true;
        onProgress({
          phase: 'processing',
          loaded: event.loaded,
          total: event.total,
          percent: 100,
          bytesPerSecond: instantSpeed || averageSpeed,
        });
        return;
      }
      onProgress({
        phase: 'uploading',
        loaded: event.loaded,
        total: event.total,
        percent,
        bytesPerSecond: instantSpeed || averageSpeed,
      });
    };

    xhr.upload.onload = () => {
      if (!reachedBodyEnd && typeof onProgress === 'function') {
        reachedBodyEnd = true;
        onProgress({
          phase: 'processing',
          loaded: lastLoaded,
          total: lastLoaded,
          percent: 100,
          bytesPerSecond: 0,
        });
      }
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
        if (typeof onProgress === 'function') {
          onProgress({
            phase: 'success',
            loaded: lastLoaded,
            total: lastLoaded,
            percent: 100,
            bytesPerSecond: 0,
          });
        }
        resolve(data);
        return;
      }
      const payload = typeof data.message === 'object' && data.message !== null ? data.message : data;
      const rawMessage = Array.isArray(payload.message)
        ? payload.message.join(', ')
        : payload.message || data.error || '';
      const err = new Error(mapUploadHttpError(xhr.status, rawMessage));
      err.status = xhr.status;
      err.data = payload;
      reject(err);
    };

    xhr.onerror = () => {
      const err = new Error('Сеть недоступна. Проверьте соединение и попробуйте ещё раз.');
      noteFetchFailure(err);
      reject(err);
    };

    xhr.ontimeout = () => {
      const err = new Error('Превышено время ожидания загрузки. Повторите попытку.');
      err.status = 408;
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
