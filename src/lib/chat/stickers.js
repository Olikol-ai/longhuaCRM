function svgToFile(id, svg) {
  const blob = new Blob([svg], { type: 'image/svg+xml' });
  return new File([blob], `sticker-${id}.svg`, { type: 'image/svg+xml' });
}

const PACK = [
  {
    id: 'lantern',
    label: 'Фонарь',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#F7EDED"/><path d="M40 38h48v52c0 10-10 18-24 18s-24-8-24-18V38z" fill="#8B1A1A"/><rect x="36" y="46" width="56" height="8" fill="#C9A227"/><rect x="36" y="68" width="56" height="6" fill="#C9A227"/><path d="M64 22v16" stroke="#8B1A1A" stroke-width="6" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'book',
    label: 'Книга',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#FBF6E8"/><path d="M28 32h36c10 0 16 6 16 14v58c-8-6-18-8-28-8H28V32z" fill="#8B1A1A"/><path d="M64 46c0-8 6-14 16-14h36v64H92c-10 0-20 2-28 8V46z" fill="#C9A227"/><path d="M64 46v58" stroke="#6B1212" stroke-width="3"/></svg>`,
  },
  {
    id: 'seal',
    label: 'Печать',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#F7EDED"/><circle cx="64" cy="64" r="34" fill="none" stroke="#8B1A1A" stroke-width="8"/><circle cx="64" cy="64" r="18" fill="#C9A227"/><text x="64" y="72" text-anchor="middle" font-size="22" fill="#8B1A1A" font-family="serif">华</text></svg>`,
  },
  {
    id: 'dragon',
    label: 'Дракон',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#FBF6E8"/><path d="M24 86c16-28 28-40 44-40 10 0 16 6 22 4 8-2 12-12 22-10-6 14-4 22 4 30-18 2-28-8-40-6-14 2-22 16-36 28-6 6-16 8-16-6z" fill="#8B1A1A"/><circle cx="92" cy="40" r="6" fill="#C9A227"/></svg>`,
  },
  {
    id: 'gold',
    label: 'Успех',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#FBF6E8"/><polygon points="64,22 76,50 108,54 84,74 90,106 64,90 38,106 44,74 20,54 52,50" fill="#C9A227"/><circle cx="64" cy="64" r="10" fill="#8B1A1A"/></svg>`,
  },
  {
    id: 'tea',
    label: 'Чай',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#F7EDED"/><path d="M34 52h52v28c0 14-12 24-26 24s-26-10-26-24V52z" fill="#8B1A1A"/><path d="M86 58h12c8 0 12 8 12 14s-4 14-12 14H86" fill="none" stroke="#C9A227" stroke-width="6"/><path d="M48 40c4-8 8-8 12 0M64 38c4-8 8-8 12 0" stroke="#C9A227" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  },
  {
    id: 'brush',
    label: 'Кисть',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#FBF6E8"/><rect x="58" y="20" width="12" height="54" rx="4" fill="#C9A227"/><path d="M50 74h28s2 18-14 34c-16-16-14-34-14-34z" fill="#8B1A1A"/></svg>`,
  },
  {
    id: 'lotus',
    label: 'Лотос',
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="#F7EDED"/><path d="M64 96c-18-8-28-22-32-36 12 4 22 2 32-8 10 10 20 12 32 8-4 14-14 28-32 36z" fill="#8B1A1A"/><path d="M64 52c-8-16 0-28 0-28s8 12 0 28z" fill="#C9A227"/></svg>`,
  },
];

export const LONGHUA_STICKER_PACK = {
  id: 'longhua-academy',
  title: 'Longhua',
  stickers: PACK,
};

export function listStickerPacks() {
  return [LONGHUA_STICKER_PACK];
}

export function stickerToFile(sticker) {
  return svgToFile(sticker.id, sticker.svg);
}

const RECENT_KEY = 'longhua_chat_sticker_recent_v1';

export function getRecentStickers() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    if (!Array.isArray(raw)) return [];
    const byId = new Map(PACK.map((item) => [item.id, item]));
    return raw.map((id) => byId.get(id)).filter(Boolean).slice(0, 16);
  } catch {
    return [];
  }
}

export function rememberSticker(stickerId) {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const ids = Array.isArray(raw) ? raw.filter((id) => typeof id === 'string') : [];
    const next = [stickerId, ...ids.filter((id) => id !== stickerId)].slice(0, 16);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  return getRecentStickers();
}

export function findSticker(stickerId) {
  return PACK.find((item) => item.id === stickerId) || null;
}
