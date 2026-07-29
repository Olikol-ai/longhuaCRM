import { Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

function displayName(user) {
  return [user.lastName, user.firstName].filter(Boolean).join(' ') || user.email;
}

export default function FindInterlocutorDialog({ open, onOpenChange, onChatCreated }) {
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return undefined;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        setUsers(await chatsApi.directory({ query }));
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [open, query]);

  const startDirect = async (userId) => {
    const chat = await chatsApi.createDirect(userId);
    onChatCreated(chat);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Найти собеседника</DialogTitle>
          <DialogDescription>Найдите пользователя и начните личный чат.</DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Имя или email" className="pl-9" autoFocus />
        </div>
        <div className="max-h-80 space-y-1 overflow-y-auto">
          {users.map((user) => (
            <div key={user.id} className="flex items-center justify-between gap-3 rounded-md p-2 hover:bg-muted">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{displayName(user)}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email} · {user.role}</p>
              </div>
              <Button size="sm" onClick={() => void startDirect(user.id)}>Написать</Button>
            </div>
          ))}
          {!loading && !users.length ? <p className="p-3 text-center text-sm text-muted-foreground">Пользователи не найдены</p> : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
