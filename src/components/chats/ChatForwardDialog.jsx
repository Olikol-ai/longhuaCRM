import { useMemo, useState } from 'react';
import { chatsApi } from '@/api/chats.api';
import { Button, Dialog, DialogContent, DialogHeader, DialogTitle, SearchField } from '@/design-system';
import { displayUserName } from '@/lib/chat-normalize';
import { toast } from '@/components/ui/use-toast';

export default function ChatForwardDialog({
  open,
  onOpenChange,
  groups,
  message,
  decryptedBody,
}) {
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState(null);

  const chats = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(groups || {})
      .flat()
      .filter((chat) => {
        const title = (chat.title || displayUserName(chat) || '').toLowerCase();
        return !q || title.includes(q);
      });
  }, [groups, query]);

  const send = async (chat) => {
    const text = decryptedBody || message?.body;
    if (!text || chat.kind === 'direct') {
      if (chat.kind === 'direct' && !text) {
        toast({ title: 'Перешлите текст', description: 'Вложения в личные чаты пересылаются как файлы из исходного сообщения.' });
      }
    }
    setBusyId(chat.id);
    try {
      if (text && chat.kind !== 'direct') {
        await chatsApi.sendMessage(chat.id, { body: `Переслано:\n${text}` });
      } else if (text && chat.kind === 'direct') {
        toast({
          title: 'Личный чат',
          description: 'Пересылка в Direct требует открыть чат — ключи E2EE берутся из сессии.',
        });
        onOpenChange?.(false);
        return;
      } else {
        toast({ title: 'Нечего пересылать' });
        return;
      }
      toast({ title: 'Переслано' });
      onOpenChange?.(false);
    } catch (err) {
      toast({ title: 'Не удалось переслать', description: err?.message, variant: 'destructive' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Переслать</DialogTitle>
        </DialogHeader>
        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Найти чат"
          aria-label="Найти чат"
        />
        <div className="max-h-72 space-y-1 overflow-y-auto">
          {chats.map((chat) => (
            <Button
              key={chat.id}
              intent="ghost"
              className="h-auto w-full justify-start py-2"
              loading={busyId === chat.id}
              onClick={() => void send(chat)}
            >
              {chat.title || 'Чат'}
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
