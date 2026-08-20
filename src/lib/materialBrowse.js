import {
  isAudioMaterial,
  isCanvaMaterial,
  isLinkMaterial,
  isVideoMaterial,
  unpackMaterialDescription,
} from './materialMeta.js';

export const MATERIAL_SORT_OPTIONS = [
  { value: 'newest', label: 'Сначала новые' },
  { value: 'oldest', label: 'Сначала старые' },
  { value: 'title_asc', label: 'По названию: А → Я' },
  { value: 'title_desc', label: 'По названию: Я → А' },
  { value: 'size_asc', label: 'По размеру: от меньшего' },
  { value: 'size_desc', label: 'По размеру: от большего' },
  { value: 'type', label: 'По типу файла' },
  { value: 'block', label: 'По разделу' },
];

export const MATERIAL_TYPE_FILTERS = [
  { value: 'all', label: 'Все типы' },
  { value: 'pdf', label: 'PDF' },
  { value: 'audio', label: 'Аудио' },
  { value: 'video', label: 'Видео' },
  { value: 'image', label: 'Изображения' },
  { value: 'document', label: 'Документы' },
  { value: 'pptx', label: 'Презентации' },
  { value: 'archive', label: 'Архивы' },
  { value: 'link', label: 'Ссылки' },
  { value: 'canva', label: 'Canva' },
];

const IMAGE_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const DOCUMENT_EXT = new Set(['doc', 'docx', 'xls', 'xlsx']);
const ARCHIVE_EXT = new Set(['zip']);
const PPT_EXT = new Set(['ppt', 'pptx']);

function extensionOf(filename) {
  const base = String(filename || '').split('?')[0];
  const parts = base.split('.');
  if (parts.length < 2) return '';
  return parts.pop().toLowerCase();
}

export function materialFilename(material) {
  return String(
    material?.original_filename
    || material?.stored_filename
    || material?.file_url
    || '',
  );
}

export function materialSizeBytes(material) {
  const raw = material?.file_size_bytes ?? material?.fileSizeBytes ?? null;
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

export function materialCreatedAt(material) {
  return (
    material?.created_date
    || material?.created_at
    || material?.createdAt
    || ''
  );
}

export function materialBlockName(material) {
  return unpackMaterialDescription(material?.description).blockName || '';
}

export function materialPublicDescription(material) {
  return unpackMaterialDescription(material?.description).description || '';
}

export function resolveMaterialBrowseKind(material) {
  if (isCanvaMaterial(material) || material?.file_type === 'canva') return 'canva';
  if (isLinkMaterial(material) || material?.file_type === 'link') return 'link';
  if (material?.file_type === 'pdf') return 'pdf';
  if (material?.file_type === 'pptx' || PPT_EXT.has(extensionOf(materialFilename(material)))) {
    return 'pptx';
  }
  if (isAudioMaterial(material)) return 'audio';
  if (isVideoMaterial(material)) return 'video';

  const mime = String(material?.mime_type || '').toLowerCase();
  const ext = extensionOf(materialFilename(material));
  if (mime.startsWith('image/') || IMAGE_EXT.has(ext)) return 'image';
  if (DOCUMENT_EXT.has(ext)) return 'document';
  if (ARCHIVE_EXT.has(ext) || mime.includes('zip')) return 'archive';
  if (mime === 'application/pdf' || ext === 'pdf') return 'pdf';
  return material?.file_type || 'other';
}

export function compareMaterialTitles(a, b) {
  return String(a || '').localeCompare(String(b || ''), 'ru', {
    numeric: true,
    sensitivity: 'base',
  });
}

export function materialMatchesSearch(material, query) {
  const q = String(query || '').trim().toLowerCase();
  if (!q) return true;
  const meta = unpackMaterialDescription(material?.description);
  const haystack = [
    material?.title,
    materialFilename(material),
    meta.blockName,
    meta.description,
  ]
    .map((part) => String(part || '').toLowerCase())
    .join('\n');
  return haystack.includes(q);
}

export function materialMatchesTypeFilter(material, typeFilter) {
  if (!typeFilter || typeFilter === 'all') return true;
  return resolveMaterialBrowseKind(material) === typeFilter;
}

export function materialMatchesBlockFilter(material, blockFilter) {
  if (!blockFilter || blockFilter === 'all') return true;
  return materialBlockName(material) === blockFilter;
}

export function collectMaterialBlocks(materials) {
  const set = new Set();
  for (const mat of materials || []) {
    const block = materialBlockName(mat);
    if (block) set.add(block);
  }
  return [...set].sort((a, b) => compareMaterialTitles(a, b));
}

export function sortMaterials(materials, sortKey = 'newest') {
  const rows = [...(materials || [])];
  const byTitle = (a, b) =>
    compareMaterialTitles(a.title || a.name || '', b.title || b.name || '');
  const byCreated = (a, b) =>
    String(materialCreatedAt(a)).localeCompare(String(materialCreatedAt(b)));
  const bySize = (a, b) => {
    const as = materialSizeBytes(a);
    const bs = materialSizeBytes(b);
    if (as == null && bs == null) return byTitle(a, b);
    if (as == null) return 1;
    if (bs == null) return -1;
    return as - bs;
  };
  const byType = (a, b) => {
    const cmp = compareMaterialTitles(
      resolveMaterialBrowseKind(a),
      resolveMaterialBrowseKind(b),
    );
    return cmp || byTitle(a, b);
  };
  const byBlock = (a, b) => {
    const cmp = compareMaterialTitles(materialBlockName(a), materialBlockName(b));
    return cmp || byTitle(a, b);
  };

  switch (sortKey) {
    case 'title_asc':
      return rows.sort(byTitle);
    case 'title_desc':
      return rows.sort((a, b) => byTitle(b, a));
    case 'oldest':
      return rows.sort(byCreated);
    case 'size_asc':
      return rows.sort(bySize);
    case 'size_desc':
      return rows.sort((a, b) => bySize(b, a));
    case 'type':
      return rows.sort(byType);
    case 'block':
      return rows.sort(byBlock);
    case 'newest':
    default:
      return rows.sort((a, b) => byCreated(b, a));
  }
}

/**
 * Filter + sort materials already returned by ACL-scoped API.
 * Does not expand access beyond the given list.
 */
export function browseMaterials(materials, {
  search = '',
  typeFilter = 'all',
  blockFilter = 'all',
  sort = 'newest',
} = {}) {
  const filtered = (materials || []).filter((mat) => {
    if (mat?.status === 'deleted') return false;
    if (!materialMatchesSearch(mat, search)) return false;
    if (!materialMatchesTypeFilter(mat, typeFilter)) return false;
    if (!materialMatchesBlockFilter(mat, blockFilter)) return false;
    return true;
  });
  return sortMaterials(filtered, sort);
}

export function hasActiveMaterialBrowseFilters({
  search = '',
  typeFilter = 'all',
  blockFilter = 'all',
  sort = 'newest',
} = {}) {
  return Boolean(
    String(search || '').trim()
    || (typeFilter && typeFilter !== 'all')
    || (blockFilter && blockFilter !== 'all')
    || (sort && sort !== 'newest'),
  );
}

const STORAGE_PREFIX = 'longhua:materials:browse:';

export function loadMaterialBrowseState(userId, scope = 'library') {
  if (!userId || typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${scope}:${userId}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMaterialBrowseState(userId, scope, state) {
  if (!userId || typeof sessionStorage === 'undefined') return;
  try {
    sessionStorage.setItem(
      `${STORAGE_PREFIX}${scope}:${userId}`,
      JSON.stringify(state || {}),
    );
  } catch {
    // ignore quota / private mode
  }
}
