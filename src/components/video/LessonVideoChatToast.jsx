import { useEffect, useState } from 'react';
import { MessageCircle, X } from 'lucide-react';
import { cn } from '@/lib/utils';

/**
 * Floating toast for new lesson-chat messages while the chat panel is closed.
 * Auto-hides after ~15s; click opens chat.
 */
export default function LessonVideoChatToast({
  notification,
  onOpenChat,
  onDismiss,
  durationMs = 15_000,
}) {
  const [visible, setVisible] = useState(Boolean(notification));

  useEffect(() => {
    if (!notification) {
      setVisible(false);
      return undefined;
    }
    setVisible(true);
    const t = window.setTimeout(() => {
      setVisible(false);
      onDismiss?.();
    }, durationMs);
    return () => window.clearTimeout(t);
  }, [notification, durationMs, onDismiss]);

  if (!notification || !visible) return null;

  const name = notification.senderName || 'Участник';
  const body = String(notification.body || '').trim();

  return (
    <div
      className={cn(
        'pointer-events-auto absolute left-1/2 top-3 z-40 w-[min(100%-1.5rem,22rem)] -translate-x-1/2',
        'animate-in fade-in-0 slide-in-from-top-2 duration-200',
      )}
      data-testid="lesson-video-chat-toast"
    >
      <button
        type="button"
        className="flex w-full items-start gap-2.5 rounded-2xl border border-border bg-card/95 p-3 text-left shadow-xl backdrop-blur-md"
        onClick={() => {
          onOpenChat?.();
          onDismiss?.();
        }}
      >
        <span className="mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
          <MessageCircle className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-xs font-semibold text-foreground">
            {name}
          </span>
          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
            {body || 'Новое сообщение'}
          </span>
        </span>
        <span
          role="presentation"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
          onClick={(e) => {
            e.stopPropagation();
            setVisible(false);
            onDismiss?.();
          }}
        >
          <X className="h-4 w-4" />
        </span>
      </button>
    </div>
  );
}
