import { useEffect, useState } from 'react';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { displayUserName, pickField } from '@/lib/chat-normalize';

/**
 * Incoming / outgoing DM requests panel.
 */
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
    <div className="flex h-full min-h-0 flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-3 py-3">
        <h2 className="text-sm font-semibold">Запросы на переписку</h2>
        <Button variant="ghost" size="sm" onClick={onClose}>
          Закрыть
        </Button>
      </div>
      <div className="flex gap-1 border-b border-border px-2 py-2">
        <Button
          size="sm"
          variant={tab === 'incoming' ? 'default' : 'ghost'}
          onClick={() => setTab('incoming')}
        >
          Входящие
        </Button>
        <Button
          size="sm"
          variant={tab === 'outgoing' ? 'default' : 'ghost'}
          onClick={() => setTab('outgoing')}
        >
          Исходящие
        </Button>
      </div>
      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto p-3">
        {loading ? <p className="text-sm text-muted-foreground">Загрузка…</p> : null}
        {!loading && !rows.length ? (
          <p className="text-sm text-muted-foreground">Нет запросов</p>
        ) : null}
        {rows.map((req) => {
          const peer =
            tab === 'incoming'
              ? pickField(req, 'fromUser', 'from_user')
              : pickField(req, 'toUser', 'to_user');
          return (
            <div key={req.id} className="rounded-lg border border-border p-3 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium">{displayUserName(peer)}</p>
                  <p className="text-xs text-muted-foreground">{req.status}</p>
                </div>
              </div>
              {req.message ? <p className="text-sm text-muted-foreground">{req.message}</p> : null}
              {tab === 'incoming' && req.status === 'pending' ? (
                <div className="flex gap-2">
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
                    variant="outline"
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
                  variant="outline"
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
