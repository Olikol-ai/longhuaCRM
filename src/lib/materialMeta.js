/** Pack internal notes / block into description (no backend notes column). */

export const NOTES_MARKER = '\n\n___NOTES___\n';
export const BLOCK_MARKER = '___BLOCK___:';

export function packMaterialDescription({ description = '', notes = '', blockName = '' } = {}) {
  let body = String(description || '').trim();
  if (blockName?.trim()) {
    body = `${BLOCK_MARKER}${blockName.trim()}\n${body}`.trim();
  }
  if (notes?.trim()) {
    body = `${body}${NOTES_MARKER}${notes.trim()}`;
  }
  return body;
}

export function unpackMaterialDescription(raw) {
  let text = String(raw || '');
  let notes = '';
  let blockName = '';

  const notesIdx = text.indexOf(NOTES_MARKER);
  if (notesIdx >= 0) {
    notes = text.slice(notesIdx + NOTES_MARKER.length).trim();
    text = text.slice(0, notesIdx);
  }

  if (text.startsWith(BLOCK_MARKER)) {
    const nl = text.indexOf('\n');
    if (nl >= 0) {
      blockName = text.slice(BLOCK_MARKER.length, nl).trim();
      text = text.slice(nl + 1);
    } else {
      blockName = text.slice(BLOCK_MARKER.length).trim();
      text = '';
    }
  }

  return {
    description: text.trim(),
    notes,
    blockName,
  };
}

/** Student-visible description — never includes internal notes / block markers. */
export function publicMaterialDescription(raw) {
  return unpackMaterialDescription(raw).description;
}

/**
 * Visible material title for lists/cards.
 * Prefer API `title`, then original filename / name — never blank when any label exists.
 */
export function resolveMaterialDisplayTitle(material) {
  if (!material || typeof material !== 'object') return 'Без названия';
  const candidates = [
    material.title,
    material.name,
    material.original_filename,
    material.originalFilename,
    material.stored_filename,
    material.storedFilename,
  ];
  for (const raw of candidates) {
    const value = String(raw || '').trim();
    if (value) return value;
  }
  return 'Без названия';
}

const AUDIO_EXT = new Set(['mp3', 'wav', 'm4a', 'aac', 'ogg', 'opus', 'flac']);
const VIDEO_EXT = new Set(['mp4', 'webm', 'mov', '3gp']);

function extensionOf(filename) {
  return String(filename || '').split('.').pop()?.toLowerCase() || '';
}

export function detectFileType(filename) {
  const ext = extensionOf(filename);
  if (ext === 'pdf') return 'pdf';
  if (ext === 'pptx' || ext === 'ppt') return 'pptx';
  if (VIDEO_EXT.has(ext)) return 'video';
  if (AUDIO_EXT.has(ext)) return 'audio';
  return 'other';
}

export function detectLinkType(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
  if (isCanvaUrlString(url)) return 'canva';
  if (lower.includes('docs.google.com/presentation')) return 'link';
  return 'link';
}

export const CANVA_ACCESS_NOTICE =
  'Canva не предоставила доступ к этому материалу. Попросите владельца дизайна предоставить вам доступ.';

export function storedMaterialUrl(material) {
  return String(
    material?.external_link
    || material?.externalLink
    || material?.file_url
    || material?.fileUrl
    || '',
  ).trim();
}

function hostnameOfUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  try {
    const withProtocol = /^https?:\/\//i.test(raw)
      ? raw
      : raw.startsWith('//')
        ? `https:${raw}`
        : /^[a-z0-9.-]+\.[a-z]{2,}([/:?#].*)?$/i.test(raw)
          ? `https://${raw}`
          : '';
    if (!withProtocol) return '';
    return new URL(withProtocol).hostname.toLowerCase();
  } catch {
    return '';
  }
}

export function isCanvaUrlString(url) {
  const host = hostnameOfUrl(url);
  return host === 'canva.com' || host.endsWith('.canva.com');
}

export function isCanvaMaterial(material) {
  if (!material) return false;
  if (material.file_type === 'canva' || material.fileType === 'canva') return true;
  return isCanvaUrlString(storedMaterialUrl(material));
}

/**
 * External http(s) link stored on the material (Canva, Google, generic).
 * Not a Longhua /uploads blob and not a signed file path.
 */
export function isExternalLinkMaterial(material) {
  if (!material) return false;
  if (isCanvaMaterial(material)) return true;
  const type = material.file_type || material.fileType;
  if (type === 'link' || type === 'canva') return true;
  const url = storedMaterialUrl(material);
  if (!url || url.includes('/api/files/')) return false;
  if (url.startsWith('/uploads') || url.startsWith('/')) return false;
  return /^https?:\/\//i.test(url) || isCanvaUrlString(url);
}

export function classifyMaterialOpenUrl(url) {
  const raw = String(url || '').trim();
  if (!raw) {
    return { kind: 'empty', hostname: null, openUrl: null };
  }
  if (raw.startsWith('/api/files/signed/')) {
    return { kind: 'local-upload', hostname: null, openUrl: raw };
  }
  if (raw.startsWith('/')) {
    return { kind: 'local-upload', hostname: null, openUrl: raw };
  }
  const host = hostnameOfUrl(raw) || null;
  const openUrl = /^https?:\/\//i.test(raw)
    ? raw
    : raw.startsWith('//')
      ? `https:${raw}`
      : host
        ? `https://${raw.replace(/^https?:\/\//i, '')}`
        : null;
  if (openUrl && (host === 'canva.com' || (host && host.endsWith('.canva.com')))) {
    return { kind: 'external-canva', hostname: host, openUrl };
  }
  if (openUrl) {
    return { kind: 'external-http', hostname: host, openUrl };
  }
  return { kind: 'local-upload', hostname: null, openUrl: raw };
}

export function resolveMaterialTypeKey(material) {
  if (isCanvaMaterial(material)) return 'canva';
  if (isLinkMaterial(material) && !isInAppMediaMaterial(material)) {
    const stored = material?.file_type || material?.fileType;
    if (!stored || stored === 'pptx' || stored === 'link' || stored === 'canva') {
      return 'link';
    }
  }
  return material?.file_type || material?.fileType || 'other';
}

export function describeMaterialOpen(material, extras = {}) {
  const classified = classifyMaterialOpenUrl(storedMaterialUrl(material));
  return {
    materialId: material?.id ?? null,
    materialType: resolveMaterialTypeKey(material),
    urlHostname: classified.hostname,
    urlType: classified.kind,
    ...extras,
  };
}

export function isLinkMaterial(material) {
  if (!material) return false;
  const type = material.file_type || material.fileType;
  if (type === 'link' || type === 'canva') return true;
  if (isCanvaMaterial(material)) return true;
  const url = storedMaterialUrl(material);
  return /^https?:\/\//i.test(url) && !url.includes('/api/files/');
}

function materialFilenameHint(material) {
  return (
    material?.original_filename
    || material?.stored_filename
    || material?.file_url
    || material?.title
    || ''
  );
}

export function isAudioMaterial(material) {
  if (!material) return false;
  if (material.file_type === 'audio') return true;
  const mime = String(material.mime_type || '').toLowerCase();
  if (mime.startsWith('audio/')) return true;
  return AUDIO_EXT.has(extensionOf(materialFilenameHint(material)));
}

export function isVideoMaterial(material) {
  if (!material) return false;
  if (material.file_type === 'video') return true;
  const mime = String(material.mime_type || '').toLowerCase();
  if (mime.startsWith('video/')) return true;
  return VIDEO_EXT.has(extensionOf(materialFilenameHint(material)));
}

/** Audio/video that should open in the CRM media preview (not a raw new tab). */
export function isInAppMediaMaterial(material) {
  return isAudioMaterial(material) || isVideoMaterial(material);
}
