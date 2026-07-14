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

export function detectFileType(filename) {
  const ext = String(filename || '').split('.').pop()?.toLowerCase() || '';
  const typeMap = {
    pdf: 'pdf',
    pptx: 'pptx',
    ppt: 'pptx',
    mp4: 'video',
    webm: 'video',
    mov: 'video',
    '3gp': 'video',
  };
  return typeMap[ext] || 'other';
}

export function detectLinkType(url) {
  const lower = String(url || '').toLowerCase();
  if (lower.includes('youtube.com') || lower.includes('youtu.be')) return 'video';
  if (lower.includes('canva.com') || lower.includes('docs.google.com/presentation')) return 'pptx';
  return 'link';
}

export function isLinkMaterial(material) {
  if (!material) return false;
  if (material.file_type === 'link') return true;
  const url = String(material.external_link || material.file_url || '');
  return /^https?:\/\//i.test(url) && !url.includes('/api/files/');
}
