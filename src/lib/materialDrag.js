/** HTML5 DnD payload for moving materials between courses/folders. */
export const MATERIAL_DRAG_MIME = 'application/x-longhua-material-ids';

export function setMaterialDragData(dataTransfer, materialIds) {
  const ids = Array.from(new Set((materialIds || []).filter(Boolean)));
  const payload = JSON.stringify(ids);
  dataTransfer.effectAllowed = 'move';
  dataTransfer.setData(MATERIAL_DRAG_MIME, payload);
  // Fallback for browsers that only expose text/plain in dragover
  dataTransfer.setData('text/plain', payload);
}

export function readMaterialDragIds(dataTransfer) {
  if (!dataTransfer) return [];
  const raw =
    dataTransfer.getData(MATERIAL_DRAG_MIME)
    || dataTransfer.getData('text/plain')
    || '';
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // ignore
  }
  return [];
}

export function isMaterialDrag(dataTransfer) {
  if (!dataTransfer) return false;
  const types = Array.from(dataTransfer.types || []);
  return types.includes(MATERIAL_DRAG_MIME);
}
