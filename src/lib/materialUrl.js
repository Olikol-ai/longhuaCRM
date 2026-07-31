import { apiFetch, getToken } from '@/api/http';

/**
 * Sync helper for display/links.
 * Uploaded files are stored as /uploads/... which the SPA catches as CRM —
 * use resolveMaterialOpenUrl() before opening.
 */
export function getMaterialUrl(material) {
  const external = String(material?.external_link ?? '').trim();
  if (external) {
    return normalizeHttpUrl(external);
  }
  const fileUrl = String(material?.file_url ?? '').trim();
  if (!fileUrl) return '#';
  if (fileUrl.startsWith('/api/files/signed/')) return fileUrl;
  if (/^https?:\/\//i.test(fileUrl)) return fileUrl;
  // Stored upload path — not directly openable in SPA mode
  return fileUrl;
}

function normalizeHttpUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '#';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('/')) return value;
  return `https://${value}`;
}

function isDirectOpenableUrl(url) {
  if (!url || url === '#') return false;
  if (url.startsWith('/api/files/signed/')) return true;
  if (/^https?:\/\//i.test(url)) return true;
  return false;
}

/**
 * Resolve a URL that actually opens the material (signed API file or external link).
 */
export async function resolveMaterialOpenUrl(material) {
  const external = String(material?.external_link ?? '').trim();
  if (external) {
    return normalizeHttpUrl(external);
  }

  const fileUrl = String(material?.file_url ?? '').trim();
  if (isDirectOpenableUrl(fileUrl)) {
    return fileUrl;
  }

  if (!material?.id) {
    throw new Error('У материала нет файла');
  }

  const data = await apiFetch(`/files/material/${material.id}/url`);
  const signed = String(data?.url ?? '').trim();
  if (!signed) {
    throw new Error('Нет доступа к файлу материала');
  }
  return signed;
}

/**
 * Open material in a new tab.
 *
 * Signed URLs embed auth in the path — the browser navigates/streams immediately.
 * Do NOT fetch+blob the whole file first (that blocked UI for large PDFs for minutes).
 */
export async function openMaterial(material) {
  // Open the tab synchronously on the click stack so popup blockers allow it,
  // then point it at the signed URL as soon as ACL returns.
  const popup = window.open('about:blank', '_blank', 'noopener,noreferrer');

  try {
    const url = await resolveMaterialOpenUrl(material);

    if (popup && !popup.closed) {
      popup.location.replace(url);
      return url;
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.assign(url);
    }
    return url;
  } catch (err) {
    try {
      popup?.close();
    } catch {
      // ignore
    }
    const message = String(err?.message || '');
    const status = Number(err?.status || 0);
    if (
      status === 404
      || /Файл был удалён или недоступен/i.test(message)
      || /not found on disk|File not found/i.test(message)
    ) {
      throw new Error('Файл был удалён или недоступен.');
    }
    throw err;
  }
}

/** Fetch material file as blob (download only — open uses streaming navigation). */
export async function downloadMaterialFile(material, filename) {
  const url = await resolveMaterialOpenUrl(material);
  const token = getToken();
  const headers = {};
  // Signed URLs are self-authenticating; Bearer only needed for legacy absolute API paths.
  if (token && url.startsWith('/api/') && !url.startsWith('/api/files/signed/')) {
    headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(url, { headers });
  if (!res.ok) {
    let message = 'Не удалось скачать файл';
    if (res.status === 404) {
      message = 'Файл был удалён или недоступен.';
    } else if (res.status === 403) {
      message = 'Нет доступа к файлу материала';
    }
    try {
      const body = await res.json();
      if (body?.message && typeof body.message === 'string') {
        message = body.message;
      }
    } catch {
      // keep mapped message
    }
    throw new Error(message);
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename || material?.title || 'material';
  a.click();
  URL.revokeObjectURL(objectUrl);
}
