/**
 * GIF provider contract. Chat 2.0 ships a local looping pack.
 * A remote provider can implement the same { search, trending } surface later
 * without changing the picker UI.
 */

function loopingSvg(id, color, label) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 120">
    <rect width="160" height="120" rx="20" fill="#F7EDED"/>
    <circle cx="80" cy="60" r="22" fill="${color}">
      <animate attributeName="r" values="18;26;18" dur="1.2s" repeatCount="indefinite"/>
    </circle>
    <text x="80" y="108" text-anchor="middle" font-size="14" fill="#8B1A1A" font-family="system-ui">${label}</text>
  </svg>`;
}

const LOCAL = [
  { id: 'pulse', label: 'Пульс', query: 'pulse heart', svg: loopingSvg('pulse', '#8B1A1A', 'Пульс') },
  { id: 'gold', label: 'Сияние', query: 'gold sparkle', svg: loopingSvg('gold', '#C9A227', 'Сияние') },
  { id: 'ok', label: 'Готово', query: 'ok check', svg: loopingSvg('ok', '#8B1A1A', 'Готово') },
  { id: 'wave', label: 'Привет', query: 'hi wave', svg: loopingSvg('wave', '#C9A227', 'Привет') },
];

export const localGifProvider = {
  id: 'longhua-local',
  async trending() {
    return LOCAL;
  },
  async search(query) {
    const q = String(query || '').trim().toLowerCase();
    if (!q) return LOCAL;
    return LOCAL.filter((item) => `${item.label} ${item.query}`.toLowerCase().includes(q));
  },
  toFile(item) {
    const blob = new Blob([item.svg], { type: 'image/svg+xml' });
    return new File([blob], `gif-${item.id}.svg`, { type: 'image/svg+xml' });
  },
};

export function createGifController(provider = localGifProvider) {
  return provider;
}
