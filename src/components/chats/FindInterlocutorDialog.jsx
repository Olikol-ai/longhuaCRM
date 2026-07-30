import { Loader2, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/use-toast';
import { displayUserName, pickField } from '@/lib/chat-normalize';
import { userFacingError } from '@/lib/userFacingError';
import { cn } from '@/lib/utils';

function normalizeDirectoryUser(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const id = raw.id;
  if (!id) return null;
  const canRequestRaw = pickField(raw, 'canRequest', 'can_request');
  const canRequest = canRequestRaw !== false && canRequestRaw !== 'false';
  return {
    id,
    email: raw.email || '',
    role: raw.role || '',
    firstName: pickField(raw, 'firstName', 'first_name'),
    lastName: pickField(raw, 'lastName', 'last_name'),
    canRequest,
    canRequestReason: pickField(raw, 'canRequestReason', 'can_request_reason') || null,
    canRequestCode: pickField(raw, 'canRequestCode', 'can_request_code') || null,
  };
}

/**
 * Search users and send a DM request (does not create a chat).
 *
 * Root-cause fix: do not hard-disable send solely based on directory soft-checks.
 * Selection enables the primary CTA; server ACL returns clear Russian errors.
 */
export default function FindInterlocutorDialog({ open, onOpenChange, onRequestSent }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [sending, setSending] = useState(false);
  const [loadError, setLoadError] = useState(null);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const rows = await chatsApi.directory({ query });
        const list = Array.isArray(rows) ? rows : [];
        setUsers(list.map(normalizeDirectoryUser).filter(Boolean));
      } catch (err) {
        setUsers([]);
        setLoadError(userFacingError(err) || 'Не удалось загрузить список');
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
      setUsers([]);
      setLoadError(null);
      setSending(false);
    }
  }, [open]);

  const selected = useMemo(
    () => users.find((user) => user.id === selectedId) || null,
    [users, selectedId],
  );

  const sendRequest = async () => {
    if (!selected?.id || sending) return;
    setSending(true);
    try {
      const request = await chatsApi.createDmRequest(
        selected.id,
        message.trim() || undefined,
      );
      toast({ title: 'Запрос на переписку отправлен.' });
      onRequestSent?.(request);
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Не удалось отправить запрос',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Новый чат</DialogTitle>
          <DialogDescription>
            Найдите пользователя, выберите его в списке и отправьте запрос на переписку.
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
            disabled={sending}
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
            disabled={sending}
          />
        </div>

        <div className="max-h-80 space-y-1 overflow-y-auto rounded-md border border-border/60 p-1">
          {loading ? (
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Поиск…
            </div>
          ) : null}

          {loadError ? (
            <p className="p-3 text-center text-sm text-destructive">{loadError}</p>
          ) : null}

          {!loading &&
            !loadError &&
            users.map((user) => {
              const isSelected = selectedId === user.id;
              return (
                <button
                  key={user.id}
                  type="button"
                  disabled={sending}
                  onClick={() => setSelectedId(user.id)}
                  className={cn(
                    'flex w-full items-start justify-between gap-3 rounded-md p-2 text-left transition-colors',
                    isSelected ? 'bg-brand/15 ring-1 ring-brand/40' : 'hover:bg-muted',
                  )}
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{displayUserName(user)}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {user.email} · {user.role}
                    </p>
                    {!user.canRequest && user.canRequestReason ? (
                      <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                        {user.canRequestReason}
                      </p>
                    ) : null}
                  </div>
                  {isSelected ? (
                    <span className="shrink-0 text-xs font-medium text-brand">Выбран</span>
                  ) : null}
                </button>
              );
            })}

          {!loading && !loadError && !users.length ? (
            <p className="p-3 text-center text-sm text-muted-foreground">
              Пользователи не найдены
            </p>
          ) : null}
        </div>

        {selected && !selected.canRequest && selected.canRequestReason ? (
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Внимание: {selected.canRequestReason}. Можно попробовать отправить — сервер подтвердит
            доступ.
          </p>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            disabled={sending}
            onClick={() => onOpenChange(false)}
          >
            Отмена
          </Button>
          <Button
            type="button"
            disabled={!selectedId || sending}
            onClick={() => void sendRequest()}
            data-testid="dm-request-send"
          >
            {sending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" /> Отправка…
              </>
            ) : (
              'Отправить запрос'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
