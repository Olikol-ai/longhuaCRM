import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { displayUserName } from '@/lib/chat-normalize';

/**
 * Search users and send a DM request (does not create a chat).
 */
export default function FindInterlocutorDialog({ open, onOpenChange, onRequestSent }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setUsers(await chatsApi.directory({ query }));
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query]);

  useEffect(() => {
    if (!open) {
      setMessage('');
      setSelectedId(null);
      setQuery('');
    }
  }, [open]);

  const sendRequest = async (userId) => {
    setSending(true);
    try {
      const request = await chatsApi.createDmRequest(userId, message.trim() || undefined);
      toast({ title: 'Запрос отправлен' });
      onRequestSent?.(request);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Не удалось отправить запрос',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
          <DialogDescription>
            Найдите пользователя и отправьте запрос на переписку.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя или email"
            className="pl-9"
            autoFocus
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">
            Сообщение (необязательно)
          </label>
          <Textarea
            rows={2}
            maxLength={500}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Короткое приветствие…"
          />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {users.map((user) => {
            const canRequest =
              user.canRequest !== false && user.can_request !== false;
            const reason = user.canRequestReason || user.can_request_reason;
            return (
            <div
              key={user.id}
              className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayUserName(user)}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {user.email} · {user.role}
                  {!canRequest && reason ? ` · ${reason}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                disabled={!canRequest || sending}
                onClick={() => {
                  setSelectedId(user.id);
                  void sendRequest(user.id);
                }}
              >
                {sending && selectedId === user.id ? '…' : 'Отправить запрос'}
              </Button>
            </div>
            );
          })}
          {!loading && !users.length ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Пользователи не найдены
            </p>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
