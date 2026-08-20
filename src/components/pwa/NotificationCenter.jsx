import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { Button } from '@/design-system';
import {
  fetchNotificationFeed,
  groupNotificationsByDay,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/lib/pwa/notificationsApi';
import { offlineStaleCaption } from '@/lib/offline/formatUpdatedAt';

function formatTime(value) {
  try {
    return new Date(value).toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

/**
 * Telegram-like notification center panel.
 */
export default function NotificationCenter({ open, onClose, onUnreadChange }) {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchNotificationFeed();
      setItems(Array.isArray(data?.items) ? data.items : []);
      setUpdatedAt(Date.now());
      onUnreadChange?.(Number(data?.unreadCount || 0));
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [onUnreadChange]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  if (!open) return null;

  const groups = groupNotificationsByDay(items);

  const openItem = async (item) => {
    try {
      if (!item.readAt) await markNotificationRead(item.id);
    } catch {
      /* ignore */
    }
    onClose?.();
    const link = item.deepLink || item.deep_link || '/';
    navigate(link);
    void load();
  };

  const renderGroup = (label, rows) => {
    if (!rows.length) return null;
    return (
      <div className="space-y-1">
        <p className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {rows.map((item) => {
          const unread = !item.readAt && !item.read_at;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => void openItem(item)}
              className={`flex min-h-11 w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors ${
                unread ? 'bg-brand/10' : 'hover:bg-muted/60'
              }`}
            >
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-brand" aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-foreground">{item.title}</span>
                <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">
                  {item.body}
                </span>
              </span>
              <span className="shrink-0 text-[11px] text-muted-foreground">
                {formatTime(item.createdAt || item.created_at)}
              </span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex justify-end bg-black/30 p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      data-testid="notification-center"
      onClick={onClose}
    >
      <div
        className="flex h-full w-full max-w-md flex-col border-l border-border bg-card shadow-xl sm:h-auto sm:max-h-[min(36rem,90vh)] sm:rounded-2xl sm:border pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:pt-0 sm:pb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <h2 className="text-base font-semibold">Уведомления</h2>
            {updatedAt ? (
              <p className="text-[11px] text-muted-foreground">{offlineStaleCaption(updatedAt)}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              intent="ghost"
              size="sm"
              className="min-h-11"
              onClick={() => {
                void markAllNotificationsRead().then(() => load());
              }}
            >
              Прочитать все
            </Button>
            <Button type="button" intent="ghost" size="sm" className="min-h-11" onClick={onClose}>
              Закрыть
            </Button>
          </div>
        </div>
        <div className="flex-1 space-y-4 overflow-y-auto p-3">
          {loading ? (
            <p className="p-4 text-sm text-muted-foreground">Загрузка…</p>
          ) : items.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground">Пока нет уведомлений</p>
          ) : (
            <>
              {renderGroup('Сегодня', groups.today)}
              {renderGroup('Вчера', groups.yesterday)}
              {renderGroup('Ранее', groups.earlier)}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
