import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Input } from '@/design-system';
import { createGifController } from '@/lib/chat/gifs';

const provider = createGifController();

export default function ChatGifPicker({ onPickFile }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let cancelled = false;
    const run = query.trim() ? provider.search(query) : provider.trending();
    void run.then((rows) => {
      if (!cancelled) setItems(Array.isArray(rows) ? rows : []);
    });
    return () => {
      cancelled = true;
    };
  }, [query]);

  return (
    <div className="flex h-72 flex-col bg-card" data-testid="chat-gif-picker">
      <div className="border-b border-border px-2 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск GIF"
            className="h-9 pl-8"
            aria-label="Поиск GIF"
          />
        </div>
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto p-2">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="overflow-hidden rounded-xl border border-border hover:border-brand/40"
            onClick={() => onPickFile?.(provider.toFile(item))}
            aria-label={item.label}
          >
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(item.svg)}`}
              alt=""
              className="h-24 w-full object-cover"
            />
          </button>
        ))}
      </div>
    </div>
  );
}
