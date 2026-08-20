import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { chatsApi } from '@/api/chats.api';
import { Button, EmptyState, IconButton } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { displayUserName, pickField } from '@/lib/chat-normalize';

/**
 * Incoming / outgoing DM requests panel (desktop aside + mobile sheet body).
 * Close control uses Design System IconButton so the X stays inside the hit target.
 */
function requestStatusLabel(status) {
  if (status === 'pending') return 'Ожидает ответа';
  if (status === 'accepted') return 'Принят';
  if (status === 'declined') return 'Отклонён';
  if (status === 'cancelled') return 'Отменён';
  return status || '';
}

export default function DmRequestsPanel({ open, onClose, onAccepted }) {
  const [tab, setTab] = useState('incoming');
  const [incoming, setIncoming] = useState([]);
  const [outgoing, setOutgoing] = useState([]);
  const [loading, setLoading] = useState(false);

  const reload = async () => {
    setLoading(true);
    try {
      const [inc, out] = await Promise.all([
        chatsApi.listIncomingDmRequests(),
        chatsApi.listOutgoingDmRequests(),
      ]);
      setIncoming(Array.isArray(inc) ? inc : []);
      setOutgoing(Array.isArray(out) ? out : []);
    } catch (err) {
      toast({ title: 'Ошибка загрузки запросов', description: err?.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) void reload();
  }, [open]);

  if (!open) return null;

  const rows = tab === 'incoming' ? incoming : outgoing;

  return (
    <div
      className="flex h-full min-h-0 flex-col overflow-hidden bg-card"
      data-testid="dm-requests-panel"
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-border px-3 py-2">
        <h2 className="min-w-0 flex-1 truncate text-sm font-semibold tracking-tight">
          Запросы на переписку
        </h2>
        <IconButton
          label="Закрыть"
          onClick={onClose}
          className="shrink-0"
          data-testid="dm-requests-close"
        >
          <X />
        </IconButton>
      </header>
      <div className="flex shrink-0 gap-1 overflow-x-auto border-b border-border px-2 py-2">
        <Button
          size="sm"
          intent={tab === 'incoming' ? 'primary' : 'ghost'}
          onClick={() => setTab('incoming')}
        >
          Входящие
        </Button>
        <Button
          size="sm"
          intent={tab === 'outgoing' ? 'primary' : 'ghost'}
          onClick={() => setTab('outgoing')}
        >
          Исходящие
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
        {!loading && !rows.length ? (
          <EmptyState
            preset="generic"
            title="Нет запросов"
            description="Новые запросы на переписку появятся здесь."
          />
        ) : null}
        {rows.map((req) => {
          const peer =
            tab === 'incoming'
              ? pickField(req, 'fromUser', 'from_user')
              : pickField(req, 'toUser', 'to_user');
          return (
            <div key={req.id} className="space-y-2 rounded-2xl bg-muted/35 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{displayUserName(peer)}</p>
                  <p className="text-xs text-muted-foreground">{requestStatusLabel(req.status)}</p>
                </div>
              </div>
              {req.message ? <p className="text-sm text-muted-foreground">{req.message}</p> : null}
              {tab === 'incoming' && req.status === 'pending' ? (
                <div className="flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    onClick={async () => {
                      try {
                        const accepted = await chatsApi.acceptDmRequest(req.id);
                        toast({ title: 'Запрос принят' });
                        onAccepted?.(accepted);
                        void reload();
                      } catch (err) {
                        toast({
                          title: 'Не удалось принять',
                          description: err?.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Принять
                  </Button>
                  <Button
                    size="sm"
                    intent="outline"
                    onClick={async () => {
                      try {
                        await chatsApi.declineDmRequest(req.id);
                        toast({ title: 'Запрос отклонён' });
                        void reload();
                      } catch (err) {
                        toast({
                          title: 'Не удалось отклонить',
                          description: err?.message,
                          variant: 'destructive',
                        });
                      }
                    }}
                  >
                    Отклонить
                  </Button>
                </div>
              ) : null}
              {tab === 'outgoing' && req.status === 'pending' ? (
                <Button
                  size="sm"
                  intent="outline"
                  onClick={async () => {
                    try {
                      await chatsApi.cancelDmRequest(req.id);
                      toast({ title: 'Запрос отменён' });
                      void reload();
                    } catch (err) {
                      toast({
                        title: 'Не удалось отменить',
                        description: err?.message,
                        variant: 'destructive',
                      });
                    }
                  }}
                >
                  Отменить
                </Button>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
