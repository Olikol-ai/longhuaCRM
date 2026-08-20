const RECENT_KEY = 'longhua_chat_emoji_recent_v1';
const SKIN_KEY = 'longhua_chat_emoji_skin_v1';

export const SKIN_TONES = [
  { id: 'none', label: 'По умолчанию', swatch: '#F5C542', modifier: '' },
  { id: '1f3fb', label: 'Светлый', swatch: '#FADCBC', modifier: '\u{1F3FB}' },
  { id: '1f3fc', label: 'Средне-светлый', swatch: '#E0BB95', modifier: '\u{1F3FC}' },
  { id: '1f3fd', label: 'Средний', swatch: '#BF8F68', modifier: '\u{1F3FD}' },
  { id: '1f3fe', label: 'Средне-тёмный', swatch: '#9B643D', modifier: '\u{1F3FE}' },
  { id: '1f3ff', label: 'Тёмный', swatch: '#5A4637', modifier: '\u{1F3FF}' },
];

const PEOPLE_WITH_SKIN = new Set([
  '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
  '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛',
  '🤜', '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💅', '🤳', '💪',
]);

export const EMOJI_CATEGORIES = [
  {
    id: 'smileys',
    label: 'Смайлы',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '😂', '🤣', '😊', '😇', '🙂', '😉',
      '😍', '🥰', '😘', '😗', '😋', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫',
      '🤔', '😐', '😑', '😶', '🙄', '😏', '😣', '😥', '😮', '🤐', '😯', '😪',
      '😫', '🥱', '😴', '😌', '😛', '😒', '😓', '😔', '😕', '🙃', '🫠', '😲',
      '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱',
      '😨', '😰', '😥', '😓', '🤗', '🫡', '🤝', '🙈', '🙉', '🙊', '💀', '👻',
      '👽', '🤖', '💩', '😺', '😸', '😹', '😻', '😼',
    ],
  },
  {
    id: 'people',
    label: 'Люди',
    emojis: [
      '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘',
      '🤙', '👈', '👉', '👆', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜',
      '👏', '🙌', '👐', '🤲', '🙏', '✍️', '💅', '💪', '👀', '🧠', '🫀', '🧑‍🎓',
      '👩‍🏫', '👨‍🏫', '🧑‍💻', '👩‍🎓', '👨‍🎓',
    ],
  },
  {
    id: 'nature',
    label: 'Природа',
    emojis: [
      '🌸', '💮', '🌹', '🌺', '🌻', '🌼', '🌷', '🌱', '🌿', '🍀', '🍁', '🍂',
      '🍃', '🐉', '🐲', '🐼', '🦊', '🐱', '🐶', '🐻', '🐨', '🐯', '🦁', '🐮',
    ],
  },
  {
    id: 'food',
    label: 'Еда',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍒', '🍑',
      '🥭', '🍍', '🥥', '🥝', '🍅', '🥕', '🌽', '🥦', '🍞', '🥐', '🥖', '🧀',
      '🍜', '🍣', '🥟', '🍚', '🍵', '☕', '🧋', '🍰',
    ],
  },
  {
    id: 'activity',
    label: 'Учёба',
    emojis: [
      '📕', '📗', '📘', '📙', '📓', '📔', '📒', '📚', '📖', '✏️', '✒️', '📝',
      '📌', '📍', '📎', '🔗', '📐', '📏', '📊', '📈', '🎓', '🏫', '🏆', '🥇',
      '🎯', '🧠', '💡', '🔔', '⏰', '📅',
    ],
  },
  {
    id: 'travel',
    label: 'Места',
    emojis: [
      '🚗', '🚕', '🚌', '🚎', '🏎️', '🚓', '🚑', '🚒', '🚐', '🚚', '🚲', '🛵',
      '✈️', '🚀', '🛸', '🏠', '🏡', '🏢', '🏣', '🏥', '🏦', '🏨', '⛩️', '🗼',
      '🗽', '🗻', '🏔️', '🌅', '🌙', '⭐',
    ],
  },
  {
    id: 'symbols',
    label: 'Символы',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '❣️', '💕', '💞',
      '💓', '💗', '💖', '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉️', '☸️', '✡️',
      '✅', '❌', '❓', '❗', '💯', '🔥', '✨', '🎉', '🎊', '💫', '⭐', '🌟',
    ],
  },
];

const SEARCH_HINTS = {
  огонь: '🔥',
  сердце: '❤️',
  смех: '😂',
  ок: '👍',
  книга: '📚',
  учёба: '🎓',
  дракон: '🐉',
  чай: '🍵',
};

export function applySkinTone(emoji, modifier) {
  if (!modifier || !PEOPLE_WITH_SKIN.has(emoji)) return emoji;
  return `${emoji}${modifier}`;
}

export function getEmojiSkin() {
  try {
    return localStorage.getItem(SKIN_KEY) || 'none';
  } catch {
    return 'none';
  }
}

export function setEmojiSkin(id) {
  localStorage.setItem(SKIN_KEY, id);
}

export function getRecentEmoji() {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(raw) ? raw.slice(0, 32) : [];
  } catch {
    return [];
  }
}

export function rememberEmoji(emoji) {
  const next = [emoji, ...getRecentEmoji().filter((item) => item !== emoji)].slice(0, 32);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  return next;
}

export function searchEmoji(query, skinId = 'none') {
  const q = String(query || '').trim().toLowerCase();
  const modifier = SKIN_TONES.find((tone) => tone.id === skinId)?.modifier || '';
  if (!q) return [];
  const hinted = SEARCH_HINTS[q];
  const out = [];
  if (hinted) out.push(applySkinTone(hinted, modifier));
  for (const category of EMOJI_CATEGORIES) {
    for (const emoji of category.emojis) {
      if (category.label.toLowerCase().includes(q) || emoji.includes(q)) {
        out.push(applySkinTone(emoji, modifier));
      }
    }
  }
  return [...new Set(out)].slice(0, 80);
}
