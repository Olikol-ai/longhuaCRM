import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { createPageUrl } from '@/utils';
import { Badge, Button, Card, EmptyState, PageLoading, SearchField } from '@/design-system';
import { Building2, Wallet, Users, Briefcase, BookOpen } from 'lucide-react';

function formatMoney(value, currency = 'BYN') {
  const n = Number.parseFloat(String(value ?? 0));
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
}

export default function SalesManagerDashboard() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [diarySummary, setDiarySummary] = useState(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const [dashboard, diary] = await Promise.all([
        api.b2b.dashboard(),
        api.b2b.diary.summary(),
      ]);
      setData(dashboard);
      setDiarySummary(diary);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить данные');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  if (loading) {
    return <PageLoading label="Загрузка продаж" />;
  }

  const summary = data?.summary ?? {};
  const diary = diarySummary ?? {};
  const organizations = (data?.organizations ?? []).filter((org) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return String(org.name ?? '').toLowerCase().includes(q);
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto w-full min-w-0 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Мои продажи</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Организации, группы и комиссия менеджера {user?.full_name || user?.email}
          </p>
          {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
        </div>
        <Link
          to={createPageUrl('SalesDiary')}
          className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline"
        >
          <BookOpen className="w-4 h-4" /> Дневник продаж
        </Link>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Building2 className="w-4 h-4" /> В дневнике
          </div>
          <p className="text-2xl font-bold">{diary.diary_entries_count ?? summary.organizations_count ?? 0}</p>
          <p className="text-xs text-muted-foreground">В работе: {diary.organizations_in_work ?? 0}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users className="w-4 h-4" /> Ученики
          </div>
          <p className="text-2xl font-bold">{diary.actual_students ?? summary.students_count ?? 0}</p>
          <p className="text-xs text-muted-foreground">
            Потенциал: {diary.potential_students ?? 0} · По договору: {diary.deal_students ?? 0}
          </p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Wallet className="w-4 h-4" /> Поступления
          </div>
          <p className="text-lg font-bold">{formatMoney(diary.receipts_total ?? summary.receipts_total)}</p>
        </Card>
        <Card className="p-4 space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Briefcase className="w-4 h-4" /> Комиссия
          </div>
          <p className="text-lg font-bold">{formatMoney(diary.commission_total ?? summary.commission_total)}</p>
          <p className="text-xs text-muted-foreground">
            К выплате: {formatMoney(summary.commission_to_pay)}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-sm">
        <Card className="p-3"><span className="text-muted-foreground">Связались</span><p className="font-bold">{diary.contacted ?? 0}</p></Card>
        <Card className="p-3"><span className="text-muted-foreground">Переговоры</span><p className="font-bold">{diary.negotiations ?? 0}</p></Card>
        <Card className="p-3"><span className="text-muted-foreground">КП отправлено</span><p className="font-bold">{diary.proposal_sent ?? 0}</p></Card>
        <Card className="p-3"><span className="text-muted-foreground">Договоров</span><p className="font-bold">{diary.contracts_signed ?? 0}</p></Card>
        <Card className="p-3 col-span-2 sm:col-span-1"><span className="text-muted-foreground">Группы</span><p className="font-bold">{summary.groups_count ?? 0}</p></Card>
      </div>

      <SearchField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск организации..."
        className="max-w-sm"
        aria-label="Поиск организации"
      />

      {organizations.length === 0 ? (
        <EmptyState preset="generic" title="Организации не найдены" icon={Building2} />
      ) : (
        <>
          <div className="hidden lg:block overflow-x-auto border rounded-xl bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="px-4 py-3">Организация</th>
                  <th className="px-4 py-3">Группы</th>
                  <th className="px-4 py-3">Ученики</th>
                  <th className="px-4 py-3">Поступило</th>
                  <th className="px-4 py-3">Комиссия</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((org) => (
                  <tr key={org.id} className="border-b last:border-0">
                    <td className="px-4 py-3 font-medium">{org.name}</td>
                    <td className="px-4 py-3">{org.groups_count}</td>
                    <td className="px-4 py-3">{org.students_count}</td>
                    <td className="px-4 py-3">{formatMoney(org.receipts_total)}</td>
                    <td className="px-4 py-3">{formatMoney(org.commission_total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="lg:hidden space-y-3">
            {organizations.map((org) => (
              <Card key={org.id} className="p-4 space-y-2">
                <p className="font-semibold">{org.name}</p>
                {org.unp && <Badge variant="muted">УНП {org.unp}</Badge>}
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div><span className="text-muted-foreground">Группы:</span> {org.groups_count}</div>
                  <div><span className="text-muted-foreground">Ученики:</span> {org.students_count}</div>
                  <div><span className="text-muted-foreground">Поступило:</span> {formatMoney(org.receipts_total)}</div>
                  <div><span className="text-muted-foreground">Комиссия:</span> {formatMoney(org.commission_total)}</div>
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      <Button type="button" intent="outline" onClick={load}>Обновить</Button>
    </div>
  );
}
