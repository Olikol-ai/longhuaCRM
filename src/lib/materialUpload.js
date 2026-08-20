/** Shared materials upload limits / accept list (frontend). */

/** Keep in sync with apps/api material-upload.limits.ts (default 2 GiB). */
export const MATERIALS_MAX_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024;

export const MATERIALS_FILE_ACCEPT = [
  '.pdf',
  '.pptx',
  '.ppt',
  '.docx',
  '.doc',
  '.xlsx',
  '.xls',
  '.mp4',
  '.webm',
  '.mov',
  '.3gp',
  '.mp3',
  '.wav',
  '.m4a',
  '.aac',
  '.ogg',
  '.opus',
  '.flac',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.zip',
].join(',');

export function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} Б`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} КБ`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} МБ`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} ГБ`;
}

export function formatUploadSpeed(bytesPerSecond) {
  const n = Number(bytesPerSecond) || 0;
  if (n <= 0) return '';
  return `${formatBytes(n)}/с`;
}

export function formatMaterialsMaxLabel(bytes = MATERIALS_MAX_UPLOAD_BYTES) {
  return formatBytes(bytes).replace(' ГБ', ' ГБ').replace(/\.00 ГБ$/, ' ГБ');
}

/**
 * Best-effort duration (seconds) from browser media metadata.
 * Returns null when the browser cannot read it.
 */
export function probeMediaDurationSeconds(file) {
  if (!file || typeof window === 'undefined') {
    return Promise.resolve(null);
  }
  const mime = String(file.type || '').toLowerCase();
  const name = String(file.name || '').toLowerCase();
  const isAudio =
    mime.startsWith('audio/')
    || /\.(mp3|wav|m4a|aac|ogg|opus|flac)$/i.test(name);
  const isVideo =
    mime.startsWith('video/')
    || /\.(mp4|webm|mov|3gp)$/i.test(name);
  if (!isAudio && !isVideo) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const el = document.createElement(isVideo ? 'video' : 'audio');
    let settled = false;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(url);
      resolve(value);
    };
    const timer = window.setTimeout(() => finish(null), 4000);
    el.preload = 'metadata';
    el.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const duration = el.duration;
      finish(Number.isFinite(duration) && duration > 0 ? Math.round(duration) : null);
    };
    el.onerror = () => {
      window.clearTimeout(timer);
      finish(null);
    };
    el.src = url;
  });
}
