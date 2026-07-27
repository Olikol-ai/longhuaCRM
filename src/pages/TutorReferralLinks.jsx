import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getGreetingName } from '@/lib/display-name';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Link2, Copy } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';

export default function TutorReferralLinks() {
  const { user } = useAuth();
  const [invites, setInvites] = useState([]);
  const [latestInviteUrl, setLatestInviteUrl] = useState('');
  const [loading, setLoading] = useState(true);
  const [inviteBusy, setInviteBusy] = useState(false);
  const [error, setError] = useState('');

  const loadData = async () => {
    setError('');
    try {
      const rows = await api.tutorInviteLinks.list();
      setInvites(Array.isArray(rows) ? rows : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить ссылки');
      setInvites([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeInvites = useMemo(
    () =>
      invites.filter(
        (row) => !row.revoked_at && new Date(row.expires_at).getTime() > Date.now(),
      ),
    [invites],
  );

  const handleCreateInvite = async () => {
    setInviteBusy(true);
    try {
      const created = await api.tutorInviteLinks.create();
      const url = `${window.location.origin}${created.path || `/register?ref=${created.token}`}`;
      setLatestInviteUrl(url);
      toast({ title: 'Ссылка приглашения создана' });
      await loadData();
    } catch (err) {
      toast({
        title: 'Не удалось создать ссылку',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    if (!latestInviteUrl) return;
    try {
      await navigator.clipboard.writeText(latestInviteUrl);
      toast({ title: 'Ссылка скопирована' });
    } catch {
      toast({ title: 'Скопируйте ссылку вручную', description: latestInviteUrl });
    }
  };

  const handleRevokeInvite = async (id) => {
    try {
      setInvites((prev) =>
        prev.map((row) =>
          row.id === id ? { ...row, revoked_at: new Date().toISOString() } : row,
        ),
      );
      setLatestInviteUrl('');
      await api.tutorInviteLinks.revoke(id);
      toast({ title: 'Ссылка отозвана' });
      await loadData();
    } catch (err) {
      await loadData();
      toast({
        title: 'Не удалось отозвать ссылку',
        description: err?.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
          Реферальные ссылки
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          {getGreetingName(user)}, создайте ссылку — после регистрации ученик закрепится
          за вами как «Ученик репетитора»
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button onClick={handleCreateInvite} disabled={inviteBusy} className="gap-2">
            {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
            Создать ссылку
          </Button>
          {latestInviteUrl && (
            <Button type="button" variant="outline" onClick={handleCopyInvite} className="gap-2">
              <Copy className="h-4 w-4" />
              Копировать
            </Button>
          )}
        </div>
        {latestInviteUrl && (
          <p className="text-xs break-all text-brand" data-testid="tutor-invite-url">
            {latestInviteUrl}
          </p>
        )}
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Созданные ссылки
        </h2>
        {invites.length === 0 ? (
          <Card className="p-6 text-center text-slate-400">Ссылок пока нет</Card>
        ) : (
          invites.map((row) => {
            const active = !row.revoked_at && new Date(row.expires_at).getTime() > Date.now();
            return (
              <Card key={row.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Badge variant={active ? 'default' : 'secondary'}>
                      {row.revoked_at ? 'Отозвана' : active ? 'Активна' : 'Истекла'}
                    </Badge>
                    {row.label && (
                      <span className="text-sm text-slate-700 dark:text-slate-200">{row.label}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    до {format(new Date(row.expires_at), 'dd.MM.yyyy')} · регистраций:{' '}
                    {row.use_count ?? 0}
                  </p>
                </div>
                {active && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => handleRevokeInvite(row.id)}>
                    Отозвать
                  </Button>
                )}
              </Card>
            );
          })
        )}
      </div>

      {activeInvites.length > 0 && (
        <p className="text-xs text-slate-400">
          Активных ссылок: {activeInvites.length}
        </p>
      )}
    </div>
  );
}
