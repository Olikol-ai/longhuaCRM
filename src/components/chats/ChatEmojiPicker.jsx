import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { IconButton, Input } from '@/design-system';
import {
  applySkinTone,
  EMOJI_CATEGORIES,
  getEmojiSkin,
  getRecentEmoji,
  rememberEmoji,
  searchEmoji,
  setEmojiSkin,
  SKIN_TONES,
} from '@/lib/chat/emoji';
import { cn } from '@/lib/utils';

export default function ChatEmojiPicker({ onPick, className }) {
  const [tab, setTab] = useState('recent');
  const [query, setQuery] = useState('');
  const [skin, setSkin] = useState(getEmojiSkin);
  const [recent, setRecent] = useState(getRecentEmoji);
  const modifier = SKIN_TONES.find((tone) => tone.id === skin)?.modifier || '';

  const items = useMemo(() => {
    if (query.trim()) return searchEmoji(query, skin);
    if (tab === 'recent') return recent.length ? recent : EMOJI_CATEGORIES[0].emojis.slice(0, 24);
    const category = EMOJI_CATEGORIES.find((row) => row.id === tab) || EMOJI_CATEGORIES[0];
    return category.emojis.map((emoji) => applySkinTone(emoji, modifier));
  }, [query, tab, skin, recent, modifier]);

  const pick = (emoji) => {
    setRecent(rememberEmoji(emoji));
    onPick?.(emoji);
  };

  return (
    <div
      className={cn('flex min-h-0 flex-col bg-card', className || 'h-72')}
      data-testid="chat-emoji-picker"
    >      <div className="flex items-center gap-2 border-b border-border px-2 py-2">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск эмодзи"
            className="h-9 pl-8"
            aria-label="Поиск эмодзи"
          />
        </div>
        <div className="flex items-center gap-1" role="group" aria-label="Тон кожи">
          {SKIN_TONES.map((tone) => (
            <button
              key={tone.id}
              type="button"
              title={tone.label}
              aria-pressed={skin === tone.id}
              className={cn(
                'h-5 w-5 rounded-full border border-border',
                skin === tone.id && 'ring-2 ring-brand',
              )}
              style={{ background: tone.swatch }}
              onClick={() => {
                setSkin(tone.id);
                setEmojiSkin(tone.id);
              }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-1 overflow-x-auto border-b border-border px-2 py-1">
        <button
          type="button"
          className={cn(
            'min-h-9 shrink-0 rounded-md px-2 text-xs font-medium',
            tab === 'recent' && !query ? 'bg-brand-soft text-brand' : 'text-muted-foreground',
          )}
          onClick={() => setTab('recent')}
        >
          Недавние
        </button>
        {EMOJI_CATEGORIES.map((category) => (
          <button
            key={category.id}
            type="button"
            className={cn(
              'min-h-9 shrink-0 rounded-md px-2 text-xs font-medium',
              tab === category.id && !query ? 'bg-brand-soft text-brand' : 'text-muted-foreground',
            )}
            onClick={() => setTab(category.id)}
          >
            {category.label}
          </button>
        ))}
      </div>
      <div
        className="grid min-h-0 flex-1 grid-cols-8 gap-0.5 overflow-y-auto overscroll-contain p-2"
        data-emoji-scroll
        onWheel={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
      >        {items.map((emoji) => (
          <IconButton
            key={emoji}
            label={emoji}
            intent="ghost"
            className="h-10 w-full min-h-10 min-w-0 text-lg"
            onClick={() => pick(emoji)}
          >
            <span aria-hidden>{emoji}</span>
          </IconButton>
        ))}
      </div>
    </div>
  );
}
