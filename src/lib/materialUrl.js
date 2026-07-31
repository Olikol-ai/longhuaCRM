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

/** Open material in a new tab (PDF/file via signed URL, links as-is). */
export async function openMaterial(material) {
  try {
    const url = await resolveMaterialOpenUrl(material);

    if (url.startsWith('/api/files/signed/')) {
      const token = getToken();
      const headers = token ? { Authorization: `Bearer ${token}` } : {};
      const res = await fetch(url, { headers });
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Файл был удалён или недоступен.');
        }
        if (res.status === 403) {
          throw new Error('Нет доступа к файлу материала');
        }
        throw new Error('Не удалось открыть файл материала');
      }
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const opened = window.open(objectUrl, '_blank', 'noopener,noreferrer');
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
      if (!opened) {
        window.location.assign(objectUrl);
      }
      return objectUrl;
    }

    const opened = window.open(url, '_blank', 'noopener,noreferrer');
    if (!opened) {
      window.location.assign(url);
    }
    return url;
  } catch (err) {
    const message = String(err?.message || '');
    if (/not found on disk|File not found/i.test(message)) {
      throw new Error('Файл был удалён или недоступен.');
    }
    throw err;
  }
}

/** Fetch material file as blob (for download with auth cookie/token when needed). */
export async function downloadMaterialFile(material, filename) {
  const url = await resolveMaterialOpenUrl(material);
  const token = getToken();
  const headers = {};
  if (token && url.startsWith('/api/')) {
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
