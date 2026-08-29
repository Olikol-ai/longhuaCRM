import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { chatsApi } from '@/api/chats.api';
import { useAuth } from '@/lib/AuthContext';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SearchField,
} from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';
import { displayUserName } from '@/lib/chat-normalize';

function peerLabel(user) {
  return displayUserName(user) || user.email || 'Пользователь';
}

/**
 * Grant homework template access to peer teachers/tutors.
 * homeworkIds: string[] — one or many owned templates.
 */
export default function HomeworkGrantAccessDialog({
  open,
  onOpenChange,
  homeworkIds = [],
  homeworkTitles = [],
  onGranted,
}) {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [peers, setPeers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [alreadyGranted, setAlreadyGranted] = useState(new Set());

  const titleHint = useMemo(() => {
    if (homeworkTitles.length === 1) return homeworkTitles[0];
    if (homeworkTitles.length > 1) return `${homeworkTitles.length} заданий`;
    return 'выбранные задания';
  }, [homeworkTitles]);

  useEffect(() => {
    if (!open) {
      setQuery('');
      setPeers([]);
      setSelectedIds([]);
      setAlreadyGranted(new Set());
      return undefined;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const [teacherRows, tutorRows, accessLists] = await Promise.all([
          chatsApi.directory({ query, role: 'teacher' }),
          chatsApi.directory({ query, role: 'tutor' }),
          homeworkIds.length === 1
            ? api.homework.listAccess(homeworkIds[0]).catch(() => [])
            : Promise.resolve([]),
        ]);
        if (cancelled) return;
        const byId = new Map();
        for (const row of [...(teacherRows || []), ...(tutorRows || [])]) {
          if (!row?.id || row.id === user?.id) continue;
          byId.set(row.id, row);
        }
        setPeers([...byId.values()]);
        const granted = new Set(
          (Array.isArray(accessLists) ? accessLists : []).map((g) => g.grantee_user_id),
        );
        setAlreadyGranted(granted);
        setSelectedIds((prev) => prev.filter((id) => !granted.has(id)));
      } catch (err) {
        if (!cancelled) {
          setPeers([]);
          toast({
            title: 'Не удалось загрузить список преподавателей',
            description: userFacingError(err),
            variant: 'destructive',
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [open, query, homeworkIds, user?.id]);

  const toggle = (id) => {
    if (alreadyGranted.has(id)) return;
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleGrant = async () => {
    if (!homeworkIds.length || !selectedIds.length) return;
    setSaving(true);
    try {
      await api.homework.bulkGrant({
        homework_ids: homeworkIds,
        grantee_user_ids: selectedIds,
      });
      toast({ title: 'Доступ предоставлен' });
      onGranted?.();
      onOpenChange?.(false);
    } catch (err) {
      toast({
        title: 'Не удалось предоставить доступ',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg max-h-[90vh] overflow-y-auto"
        data-testid="homework-grant-access-dialog"
      >
        <DialogHeader>
          <DialogTitle>Предоставить доступ</DialogTitle>
          <DialogDescription>
            Выберите преподавателей или репетиторов, которым можно видеть шаблон
            «{titleHint}» и назначать его своим ученикам.
          </DialogDescription>
        </DialogHeader>

        <SearchField
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по имени или email"
          data-testid="homework-grant-search"
        />

        <div className="mt-3 max-h-72 overflow-y-auto space-y-1 border border-border rounded-lg p-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-brand" />
            </div>
          ) : peers.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Никого не найдено
            </p>
          ) : (
            peers.map((peer) => {
              const checked = selectedIds.includes(peer.id) || alreadyGranted.has(peer.id);
              const disabled = alreadyGranted.has(peer.id);
              return (
                <label
                  key={peer.id}
                  className={`flex items-center gap-3 rounded-md px-2 py-2 text-sm ${
                    disabled ? 'opacity-60' : 'hover:bg-muted cursor-pointer'
                  }`}
                >
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={checked}
                    disabled={disabled}
                    onChange={() => toggle(peer.id)}
                    data-testid={`homework-grant-peer-${peer.id}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-medium block truncate">{peerLabel(peer)}</span>
                    <span className="text-xs text-muted-foreground block truncate">
                      {peer.email}
                      {peer.role ? ` · ${peer.role}` : ''}
                      {disabled ? ' · уже есть доступ' : ''}
                    </span>
                  </span>
                </label>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange?.(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            onClick={handleGrant}
            disabled={saving || selectedIds.length === 0 || homeworkIds.length === 0}
            data-testid="homework-grant-confirm"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Предоставить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
