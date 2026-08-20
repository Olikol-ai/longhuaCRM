import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { getGreetingName } from '@/lib/display-name';
import { inviteUrlFromResponse, inviteUrlFromRow, isActiveInvite } from '@/lib/invite-links';
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
      const list = Array.isArray(rows) ? rows : [];
      setInvites(list);
      const active = list.find(isActiveInvite);
      setLatestInviteUrl(active ? inviteUrlFromRow(active) : '');
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить ссылки');
      setInvites([]);
      setLatestInviteUrl('');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeInvites = useMemo(
    () => invites.filter(isActiveInvite),
    [invites],
  );

  /** Idempotent: server returns the single active link (creates only if missing). */
  const handleEnsureInvite = async () => {
    setInviteBusy(true);
    try {
      const ensured = await api.tutorInviteLinks.create();
      const url = inviteUrlFromResponse(ensured);
      setLatestInviteUrl(url);
      if (ensured?.created) {
        toast({ title: 'Ссылка приглашения создана' });
      } else {
        toast({ title: 'Ссылка уже существует' });
      }
      await loadData();
    } catch (err) {
      toast({
        title: 'Не удалось получить ссылку',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setInviteBusy(false);
    }
  };

  const handleCopyInvite = async () => {
    let url = latestInviteUrl;
    if (!url) {
      setInviteBusy(true);
      try {
        const ensured = await api.tutorInviteLinks.create();
        url = inviteUrlFromResponse(ensured);
        setLatestInviteUrl(url);
        await loadData();
      } catch (err) {
        toast({
          title: 'Не удалось получить ссылку',
          description: err?.message,
          variant: 'destructive',
        });
        return;
      } finally {
        setInviteBusy(false);
      }
    }
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Ссылка скопирована' });
    } catch {
      toast({ title: 'Скопируйте ссылку вручную', description: url });
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
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
          Реферальные ссылки
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {getGreetingName(user)
            ? `${getGreetingName(user)}, одна постоянная ссылка — после регистрации ученик закрепится за вами как «Ученик репетитора»`
            : 'Одна постоянная ссылка — после регистрации ученик закрепится за вами как «Ученик репетитора»'}
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-2">
          {!latestInviteUrl && (
            <Button onClick={handleEnsureInvite} disabled={inviteBusy} className="gap-2">
              {inviteBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              Получить ссылку
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            onClick={handleCopyInvite}
            disabled={inviteBusy}
            className="gap-2"
            data-testid="tutor-invite-copy"
          >
            <Copy className="h-4 w-4" />
            Скопировать ссылку
          </Button>
        </div>
        {latestInviteUrl && (
          <p className="text-xs break-all text-brand" data-testid="tutor-invite-url">
            {latestInviteUrl}
          </p>
        )}
      </Card>

      <div className="space-y-2">
        <h2 className="text-sm font-semibold text-foreground">
          Активная ссылка
        </h2>
        {activeInvites.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">Ссылки пока нет</Card>
        ) : (
          activeInvites.map((row) => (
            <Card key={row.id} className="p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <Badge variant="default">Активна</Badge>
                  {row.label && (
                    <span className="text-sm text-foreground dark:text-slate-200">{row.label}</span>
                  )}
                </div>
                <p className="text-xs break-all text-brand mt-1">{inviteUrlFromRow(row)}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  до {format(new Date(row.expires_at || row.expiresAt), 'dd.MM.yyyy')} · регистраций:{' '}
                  {row.use_count ?? row.useCount ?? 0}
                </p>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => handleRevokeInvite(row.id)}>
                Отозвать
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
