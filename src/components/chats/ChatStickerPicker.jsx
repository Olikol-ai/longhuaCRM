import { Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Input } from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
import {
  getRecentStickers,
  listStickerPacks,
  rememberSticker,
  stickerToFile,
} from '@/lib/chat/stickers';

export default function ChatStickerPicker({ onPickFile }) {
  const packs = listStickerPacks();
  const [query, setQuery] = useState('');
  const [recent, setRecent] = useState(getRecentStickers);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return packs.map((pack) => ({
      ...pack,
      stickers: pack.stickers.filter((sticker) => {
        if (!q) return true;
        return sticker.label.toLowerCase().includes(q) || sticker.id.includes(q);
      }),
    }));
  }, [packs, query]);

  const pick = (sticker) => {
    setRecent(rememberSticker(sticker.id));
    onPickFile?.(stickerToFile(sticker));
  };

  return (
    <div className="flex h-72 flex-col bg-card" data-testid="chat-sticker-picker">
      <div className="border-b border-border px-2 py-2">
        <div className="relative">
          <Search
            className={`${iconSize.sm} pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground`}
          />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск стикеров"
            className="h-9 pl-8"
            aria-label="Поиск стикеров"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {!query.trim() && recent.length ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Недавние
            </p>
            <div className="grid grid-cols-4 gap-2">
              {recent.map((sticker) => (
                <button
                  key={`recent-${sticker.id}`}
                  type="button"
                  className="flex min-h-touch flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-2 transition-colors hover:border-brand/40 hover:bg-brand-soft"
                  onClick={() => pick(sticker)}
                  aria-label={sticker.label}
                >
                  <img
                    src={`data:image/svg+xml;utf8,${encodeURIComponent(sticker.svg)}`}
                    alt=""
                    className="h-14 w-14"
                  />
                </button>
              ))}
            </div>
          </div>
        ) : null}
        {filtered.map((pack) => (
          <div key={pack.id}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {pack.title}
            </p>
            {pack.stickers.length ? (
              <div className="grid grid-cols-4 gap-2">
                {pack.stickers.map((sticker) => (
                  <button
                    key={sticker.id}
                    type="button"
                    className="flex min-h-touch flex-col items-center justify-center rounded-xl border border-border bg-muted/40 p-2 transition-colors hover:border-brand/40 hover:bg-brand-soft"
                    onClick={() => pick(sticker)}
                    aria-label={sticker.label}
                  >
                    <img
                      src={`data:image/svg+xml;utf8,${encodeURIComponent(sticker.svg)}`}
                      alt=""
                      className="h-14 w-14"
                    />
                  </button>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Ничего не найдено</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
