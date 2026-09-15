import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageLoading,
  SearchField,
} from '@/design-system';
import {
  SALES_DIARY_STATUS_LABELS,
  formatDiaryDate,
} from '@/lib/sales-diary.constants';
import { BookOpen, Building2, Trash2, UserPlus } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { displayRole } from '@/lib/user-account-role';

function managerLabel(user) {
  const name = [user.last_name, user.first_name].filter(Boolean).join(' ').trim();
  return name || user.email || user.id;
}

export default function B2bSalesDiaryPanel({ organizations = [] }) {
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]);
  const [managers, setManagers] = useState([]);
  const [selectedManagerId, setSelectedManagerId] = useState('');
  const [search, setSearch] = useState('');
  const [addOrgId, setAddOrgId] = useState('');
  const [bulkOrgIds, setBulkOrgIds] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const [list, users] = await Promise.all([
        api.b2b.diary.listEntries(
          selectedManagerId ? { managerUserId: selectedManagerId } : {},
        ),
        api.users.list(),
      ]);
      setEntries(Array.isArray(list) ? list : []);
      const mgrs = (Array.isArray(users) ? users : []).filter(
        (u) => displayRole(u) === 'sales_manager',
      );
      setManagers(mgrs);
      if (!selectedManagerId && mgrs[0]) {
        setSelectedManagerId(mgrs[0].id);
      }
    } catch (err) {
      toast({ title: 'Ошибка загрузки дневника', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [selectedManagerId]);

  const orgsNotInDiary = useMemo(() => {
    const inDiary = new Set(entries.map((e) => e.organization_id));
    return organizations.filter((o) => !inDiary.has(o.id));
  }, [organizations, entries]);

  const filteredEntries = entries.filter((e) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      String(e.organization_name ?? '').toLowerCase().includes(q)
      || String(e.organization_unp ?? '').toLowerCase().includes(q)
    );
  });

  const addOne = async (e) => {
    e.preventDefault();
    if (!selectedManagerId || !addOrgId) return;
    try {
      await api.b2b.diary.createEntry({
        organizationId: addOrgId,
        salesManagerUserId: selectedManagerId,
      });
      setAddOrgId('');
      toast({ title: 'Организация добавлена в дневник' });
      await load();
    } catch (err) {
      toast({ title: 'Не удалось добавить', description: err.message, variant: 'destructive' });
    }
  };

  const addBulk = async (e) => {
    e.preventDefault();
    if (!selectedManagerId) return;
    const ids = bulkOrgIds
      .split(/[\n,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (ids.length === 0) return;
    try {
      const result = await api.b2b.diary.bulkCreateEntries({
        organizationIds: ids,
        salesManagerUserId: selectedManagerId,
      });
      toast({
        title: 'Bulk-добавление',
        description: `Добавлено: ${result.created?.length ?? 0}, ошибок: ${result.errors?.length ?? 0}`,
      });
      setBulkOrgIds('');
      await load();
    } catch (err) {
      toast({ title: 'Bulk-добавление не удалось', description: err.message, variant: 'destructive' });
    }
  };

  const removeEntry = async (id) => {
    if (!window.confirm('Удалить организацию из дневника? История заметок будет удалена.')) return;
    try {
      await api.b2b.diary.removeEntry(id);
      toast({ title: 'Удалено из дневника' });
      await load();
    } catch (err) {
      toast({ title: 'Ошибка', description: err.message, variant: 'destructive' });
    }
  };

  const reassign = async (entryId, managerUserId) => {
    if (!managerUserId) return;
    try {
      await api.b2b.diary.reassignEntry(entryId, { salesManagerUserId: managerUserId });
      toast({ title: 'Менеджер переназначен' });
      await load();
    } catch (err) {
      toast({ title: 'Ошибка переназначения', description: err.message, variant: 'destructive' });
    }
  };

  if (loading && entries.length === 0) {
    return <PageLoading label="Загрузка дневников менеджеров" />;
  }

  return (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <h2 className="font-semibold flex items-center gap-2">
          <BookOpen className="w-4 h-4" /> Дневник менеджеров
        </h2>
        <label className="block text-sm">
          <span className="text-muted-foreground">Менеджер</span>
          <select
            className="mt-1 w-full rounded-lg border bg-background px-3 py-2 text-sm"
            value={selectedManagerId}
            onChange={(e) => setSelectedManagerId(e.target.value)}
          >
            <option value="">Все менеджеры</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{managerLabel(m)}</option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="p-4 space-y-3">
        <h3 className="font-medium flex items-center gap-2"><UserPlus className="w-4 h-4" /> Добавить организацию</h3>
        <form onSubmit={addOne} className="grid sm:grid-cols-2 gap-3">
          <select
            className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2"
            value={addOrgId}
            onChange={(e) => setAddOrgId(e.target.value)}
            required
          >
            <option value="">Выберите организацию</option>
            {orgsNotInDiary.map((o) => (
              <option key={o.id} value={o.id}>{o.name}{o.unp ? ` (УНП ${o.unp})` : ''}</option>
            ))}
          </select>
          <Button type="submit" className="sm:col-span-2 w-fit" disabled={!selectedManagerId}>
            Добавить одну
          </Button>
        </form>

        <form onSubmit={addBulk} className="space-y-2 border-t pt-3">
          <p className="text-sm text-muted-foreground">Bulk: UUID организаций через запятую или с новой строки</p>
          <textarea
            className="w-full rounded-lg border bg-background px-3 py-2 text-sm min-h-[80px]"
            value={bulkOrgIds}
            onChange={(e) => setBulkOrgIds(e.target.value)}
            placeholder="uuid1, uuid2..."
          />
          <Button type="submit" intent="outline" disabled={!selectedManagerId}>Добавить несколько</Button>
        </form>
      </Card>

      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск..."
        className="max-w-sm"
      />

      {filteredEntries.length === 0 ? (
        <EmptyState preset="generic" title="Записей нет" icon={Building2} />
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <Card key={entry.id} className="p-4 space-y-2 min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-semibold break-words">{entry.organization_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {entry.sales_manager_name || '—'} · добавлено {formatDiaryDate(entry.created_at)}
                  </p>
                </div>
                <Badge variant="muted">{SALES_DIARY_STATUS_LABELS[entry.status] ?? entry.status}</Badge>
              </div>
              <p className="text-sm text-muted-foreground line-clamp-2">
                {entry.latest_note_preview ? `«${entry.latest_note_preview}»` : 'Заметок пока нет'}
              </p>
              <p className="text-xs text-muted-foreground">
                Последний контакт: {formatDiaryDate(entry.last_contact_at)} · Следующий: {formatDiaryDate(entry.next_contact_at)}
              </p>
              <div className="flex flex-wrap gap-2 items-center">
                <select
                  className="rounded-lg border bg-background px-2 py-1 text-xs"
                  defaultValue=""
                  onChange={(e) => {
                    const newManagerId = e.target.value;
                    if (newManagerId) reassign(entry.id, newManagerId);
                    e.target.value = '';
                  }}
                >
                  <option value="">Переназначить...</option>
                  {managers.filter((m) => m.id !== entry.sales_manager_user_id).map((m) => (
                    <option key={m.id} value={m.id}>{managerLabel(m)}</option>
                  ))}
                </select>
                <Button type="button" intent="outline" size="sm" onClick={() => removeEntry(entry.id)}>
                  <Trash2 className="w-3 h-3 mr-1" /> Удалить
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Button type="button" intent="outline" onClick={load}>Обновить</Button>
    </div>
  );
}
