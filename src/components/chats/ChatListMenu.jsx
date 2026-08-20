import { Archive, BellOff, Eye, Pin, Star, Volume2 } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { iconSize } from '@/design-system/tokens/icon';

/**
 * Desktop/mobile context menu for chat list prefs.
 * Outside-close uses pointerdown after a tick so the opening contextmenu
 * cannot immediately dismiss the menu (common desktop bug).
 */
export default function ChatListMenu({
  x,
  y,
  pinned,
  muted,
  favorite,
  archived,
  onAction,
  onClose,
}) {
  const ref = useRef(null);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === 'Escape') onClose?.();
    };
    let removePointer = () => {};
    const timer = window.setTimeout(() => {
      const onPointer = (event) => {
        if (!ref.current?.contains(event.target)) onClose?.();
      };
      window.addEventListener('pointerdown', onPointer, true);
      removePointer = () => window.removeEventListener('pointerdown', onPointer, true);
    }, 0);
    window.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(timer);
      removePointer();
      window.removeEventListener('keydown', onKey);
    };
  }, [onClose]);

  const left = Math.min(x, (typeof window !== 'undefined' ? window.innerWidth : 320) - 220);
  const top = Math.min(y, (typeof window !== 'undefined' ? window.innerHeight : 400) - 280);

  const items = [
    { id: 'mark_unread', label: 'Пометить непрочитанным', icon: Eye },
    { id: 'pin', label: pinned ? 'Открепить' : 'Закрепить', icon: Pin },
    { id: 'mute', label: muted ? 'Включить звук' : 'Отключить уведомления', icon: muted ? Volume2 : BellOff },
    { id: 'favorite', label: favorite ? 'Убрать из избранного' : 'Добавить в избранное', icon: Star },
    {
      id: 'archive',
      label: archived ? 'Вернуть из архива' : 'Переместить в архив',
      icon: Archive,
    },
  ];

  return (
    <div
      ref={ref}
      role="menu"
      className="lh-chat-menu fixed z-[70] min-w-[12.5rem] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-lg"
      style={{ left, top }}
      onContextMenu={(event) => event.preventDefault()}
    >
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.id}
            type="button"
            role="menuitem"
            className="flex min-h-11 w-full items-center gap-2 px-3 text-sm text-foreground hover:bg-muted"
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
  );
}
