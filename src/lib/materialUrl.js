import { apiFetch, getToken } from '@/api/http';
import { OfflineMutationError } from '@/lib/offline/offlineGuard';
import { isOfflineMode } from '@/lib/offline/offlineStatus';
import { OFFLINE_OPEN_FILE_MESSAGE } from '@/lib/offline/constants';
import {
  CANVA_ACCESS_NOTICE,
  classifyMaterialOpenUrl,
  describeMaterialOpen,
  isCanvaMaterial,
  isExternalLinkMaterial,
  storedMaterialUrl,
} from '@/lib/materialMeta';

/**
 * Sync helper for display/links.
 * Uploaded files are stored as /uploads/... which the SPA catches as CRM —
 * use resolveMaterialOpenUrl() before opening.
 */
export function getMaterialUrl(material) {
  const classified = classifyMaterialOpenUrl(storedMaterialUrl(material));
  if (classified.openUrl) return classified.openUrl;
  return '#';
}

function isDirectOpenableUrl(url) {
  if (!url || url === '#') return false;
  if (url.startsWith('/api/files/signed/')) return true;
  if (/^https?:\/\//i.test(url)) return true;
  return false;
}

function logMaterialOpenDiagnostics(material, extras = {}) {
  const info = describeMaterialOpen(material, extras);
  // Safe fields only — never tokens, cookies, or the full URL.
  console.info('[materials.open]', info);
  return info;
}

/**
 * Resolve a URL that actually opens the material (signed API file or external link).
 * Canva / other http(s) links are returned as stored — never rewritten per user.
 */
export async function resolveMaterialOpenUrl(material) {
  const classified = classifyMaterialOpenUrl(storedMaterialUrl(material));
  if (classified.kind === 'external-canva' || classified.kind === 'external-http') {
    return classified.openUrl;
  }

  const fileUrl = classified.openUrl || storedMaterialUrl(material);
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

async function notifyCanvaAccessModel(material) {
  if (!isCanvaMaterial(material)) return;
  try {
    const { toast } = await import('@/components/ui/use-toast');
    toast({
      title: 'Эта ссылка открывается в Canva',
      description:
        'Longhua выдаёт доступ к материалу. Если Canva не предоставила доступ к этому материалу, попросите владельца дизайна предоставить вам доступ.',
    });
  } catch {
    // Toast is optional; opening the URL still proceeds.
  }
}

/**
 * Open material in a new tab.
 *
 * Signed URLs embed auth in the path — the browser navigates/streams immediately.
 * Do NOT fetch+blob the whole file first (that blocked UI for large PDFs for minutes).
 * Do NOT await chat/unread/socket work — materials open independently of Layout badge sync.
 * Do NOT proxy Canva through Longhua. External URLs are opened as stored.
 */
export async function openMaterial(material) {
  if (isOfflineMode() || (typeof navigator !== 'undefined' && navigator.onLine === false)) {
    throw new OfflineMutationError(OFFLINE_OPEN_FILE_MESSAGE);
  }

  logMaterialOpenDiagnostics(material);

  // Keep a handle to the blank tab. Avoid "noopener" on the initial open —
  // modern browsers return null with noopener, which forced a second open after
  // the signed-URL round-trip and delayed navigation.
  const popup = window.open('about:blank', '_blank');
  try {
    if (popup) popup.opener = null;
  } catch {
    // ignore
  }

  try {
    const url = await resolveMaterialOpenUrl(material);
    await notifyCanvaAccessModel(material);

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
    if (isCanvaMaterial(material)) {
      throw new Error(CANVA_ACCESS_NOTICE);
    }
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
  if (isExternalLinkMaterial(material) || isCanvaMaterial(material)) {
    throw new Error(
      isCanvaMaterial(material)
        ? CANVA_ACCESS_NOTICE
        : 'Это внешняя ссылка. Откройте её, а не скачивайте как файл.',
    );
  }
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
