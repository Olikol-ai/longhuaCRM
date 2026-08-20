import {
  Copy,
  CornerUpLeft,
  Forward,
  Pencil,
  Pin,
  Smile,
  Trash2,
} from 'lucide-react';
import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { iconSize } from '@/design-system/tokens/icon';
import { useIsLgUp } from '@/lib/responsive';
import { cn } from '@/lib/utils';

const ITEMS = [
  { id: 'reply', label: 'Ответить', icon: CornerUpLeft },
  { id: 'react', label: 'Реакция', icon: Smile },
  { id: 'edit', label: 'Редактировать', icon: Pencil, own: true },
  { id: 'pin', label: 'Закрепить', icon: Pin },
  { id: 'copy', label: 'Копировать', icon: Copy },
  { id: 'forward', label: 'Переслать', icon: Forward },
  { id: 'select', label: 'Выделить', icon: Copy },
  { id: 'delete', label: 'Удалить', icon: Trash2, own: true, danger: true },
];

/**
 * Desktop: floating menu. Mobile: bottom action sheet (no auto-focus / text selection).
 */
export default function ChatContextMenu({
  x,
  y,
  own,
  onAction,
  onClose,
}) {
  const ref = useRef(null);
  const isLgUp = useIsLgUp();

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    const onDown = (event) => {
      if (!ref.current?.contains(event.target)) onClose?.();
    };
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown);
    };
  }, [onClose]);

  useEffect(() => {
    // Prevent iOS from restoring selection / focusing first button.
    const active = document.activeElement;
    if (active && typeof active.blur === 'function') active.blur();
    window.getSelection?.()?.removeAllRanges?.();
  }, []);

  if (typeof document === 'undefined') return null;

  const items = ITEMS.filter((item) => !item.own || own);

  if (!isLgUp) {
    return createPortal(
      <div
        className="fixed inset-0 z-[70] flex flex-col justify-end"
        role="dialog"
        aria-modal="true"
        aria-label="Действия с сообщением"
        data-testid="chat-context-menu"
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          aria-label="Закрыть"
          onClick={() => onClose?.()}
        />
        <div
          ref={ref}
          className="relative z-10 max-h-[min(70dvh,28rem)] overflow-y-auto rounded-t-2xl border border-border bg-popover shadow-xl safe-pb"
        >
          <div className="mx-auto mt-2 mb-1 h-1 w-10 rounded-full bg-muted" aria-hidden />
          <div className="py-1" role="menu">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="menuitem"
                  tabIndex={-1}
                  className={cn(
                    'flex min-h-12 w-full items-center gap-3 px-4 text-[15px]',
                    item.danger ? 'text-destructive' : 'text-foreground',
                    'active:bg-muted',
                  )}
                  onClick={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    onAction?.(item.id);
                  }}
                >
                  <Icon className={iconSize.md} />
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>,
      document.body,
    );
  }

  const left = Math.min(Math.max(8, x), window.innerWidth - 220);
  const top = Math.min(Math.max(8, y), window.innerHeight - 320);

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[69] bg-black/20"
        aria-hidden
        onClick={() => onClose?.()}
      />
      <div
        ref={ref}
        role="menu"
        data-testid="chat-context-menu"
        className="lh-chat-menu fixed z-[70] min-w-[12.5rem] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
        style={{ left, top }}
      >
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              tabIndex={-1}
              className={`flex min-h-11 w-full items-center gap-2 px-3 text-sm ${
                item.danger ? 'text-destructive' : 'text-foreground'
              } hover:bg-muted`}
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onAction?.(item.id);
              }}
            >
              <Icon className={iconSize.sm} />
              {item.label}
            </button>
          );
        })}
      </div>
    </>,
    document.body,
  );
}
