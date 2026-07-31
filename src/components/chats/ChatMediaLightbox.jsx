import { Download, X, ZoomIn, ZoomOut } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Full-screen media viewer for chat images (and multi-image gallery).
 * Esc / backdrop / close button dismiss. Zoom + prev/next for galleries.
 */
export default function ChatMediaLightbox({
  items = [],
  index = 0,
  open,
  onClose,
  onDownload,
}) {
  const [current, setCurrent] = useState(index);
  const [zoom, setZoom] = useState(1);

  useEffect(() => {
    if (open) {
      setCurrent(index);
      setZoom(1);
    }
  }, [open, index]);

  const item = items[current] || null;
  const hasMany = items.length > 1;

  const go = useCallback(
    (delta) => {
      if (!hasMany) return;
      setCurrent((prev) => (prev + delta + items.length) % items.length);
      setZoom(1);
    },
    [hasMany, items.length],
  );

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
      if (event.key === 'ArrowLeft') go(-1);
      if (event.key === 'ArrowRight') go(1);
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, go]);

  const title = useMemo(
    () => item?.name || item?.originalFilename || 'Изображение',
    [item],
  );

  if (!open || !item?.src) return null;

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-black/90 text-white"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose?.();
      }}
    >
      <header className="flex items-center gap-2 px-3 py-2 safe-pt">
        <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11 text-white hover:bg-white/10"
          onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.25).toFixed(2))))}
          aria-label="Уменьшить"
        >
          <ZoomOut className="h-5 w-5" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11 text-white hover:bg-white/10"
          onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
          aria-label="Увеличить"
        >
          <ZoomIn className="h-5 w-5" />
        </Button>
        {onDownload ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="min-h-11 min-w-11 text-white hover:bg-white/10"
            onClick={() => onDownload(item)}
            aria-label="Скачать"
          >
            <Download className="h-5 w-5" />
          </Button>
        ) : null}
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="min-h-11 min-w-11 text-white hover:bg-white/10"
          onClick={onClose}
          aria-label="Закрыть"
        >
          <X className="h-5 w-5" />
        </Button>
      </header>

      <div
        className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 pb-4"
        onClick={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        {hasMany ? (
          <button
            type="button"
            className="absolute left-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl"
            onClick={() => go(-1)}
            aria-label="Предыдущее"
          >
            ‹
          </button>
        ) : null}
        <img
          src={item.src}
          alt={title}
          className={cn(
            'max-h-full max-w-full object-contain transition-transform duration-150 select-none',
          )}
          style={{ transform: `scale(${zoom})` }}
          draggable={false}
        />
        {hasMany ? (
          <button
            type="button"
            className="absolute right-2 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-black/50 text-xl"
            onClick={() => go(1)}
            aria-label="Следующее"
          >
            ›
          </button>
        ) : null}
      </div>
      {hasMany ? (
        <p className="pb-3 text-center text-xs text-white/70 safe-pb">
          {current + 1} / {items.length}
        </p>
      ) : null}
    </div>
  );
}
