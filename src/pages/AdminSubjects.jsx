import { useCallback, useEffect, useState } from 'react';
import { BookOpen, Plus, RefreshCw, Users } from 'lucide-react';
import { chatsApi } from '@/api/chats.api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/use-toast';
import PageShell from '@/components/responsive/PageShell';
import ResponsiveTable from '@/components/responsive/ResponsiveTable';

function slugify(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9а-яё]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64) || 'subject';
}

function isActive(row) {
  return row?.isActive ?? row?.is_active !== false;
}

export default function AdminSubjects() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await chatsApi.subjects.listAdmin();
      setRows(Array.isArray(data) ? data : []);
    } catch (error) {
      toast({
        title: 'Не удалось загрузить предметы',
        description: error?.message || 'Ошибка API',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const data = await chatsApi.subjects.getAdmin(selectedId);
        if (!cancelled) setDetail(data);
      } catch (error) {
        if (!cancelled) {
          toast({
            title: 'Не удалось открыть предмет',
            description: error?.message || 'Ошибка API',
            variant: 'destructive',
          });
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  async function handleCreate(event) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await chatsApi.subjects.create({
        name: trimmed,
        slug: (slug || slugify(trimmed)).trim().toLowerCase(),
      });
      setName('');
      setSlug('');
      toast({ title: 'Предмет создан', description: 'Системный чат добавлен автоматически' });
      await load();
    } catch (error) {
      toast({
        title: 'Не удалось создать предмет',
        description: error?.message || 'Ошибка API',
        variant: 'destructive',
      });
    }
  }

  async function toggleActive(row) {
    try {
      await chatsApi.subjects.update(row.id, { isActive: !isActive(row) });
      await load();
      if (selectedId === row.id) {
        setDetail(await chatsApi.subjects.getAdmin(row.id));
      }
    } catch (error) {
      toast({
        title: 'Не удалось обновить предмет',
        description: error?.message || 'Ошибка API',
        variant: 'destructive',
      });
    }
  }

  const columns = [
    {
      id: 'name',
      header: 'Предмет',
      cell: (row) => (
        <button
          type="button"
          className="text-left font-medium text-foreground hover:text-brand"
          onClick={() => setSelectedId(row.id)}
        >
          📚 {row.name}
        </button>
      ),
    },
    {
      id: 'slug',
      header: 'Slug',
      cell: (row) => <span className="text-muted-foreground">{row.slug}</span>,
    },
    {
      id: 'members',
      header: 'Участники',
      cell: (row) => row.memberCount ?? row.member_count ?? 0,
    },
    {
      id: 'chat',
      header: 'Чат',
      cell: (row) => row.chatTitle || row.chat_title || '—',
    },
    {
      id: 'active',
      header: 'Статус',
      cell: (row) => (
        <Button variant="outline" size="sm" onClick={() => toggleActive(row)}>
          {isActive(row) ? 'Активен' : 'Выключен'}
        </Button>
      ),
    },
  ];

  return (
    <PageShell>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Предметы</h1>
          <p className="text-sm text-muted-foreground">
            Справочник предметов и системные предметные чаты
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load}>
          <RefreshCw className="h-4 w-4" /> Обновить
        </Button>
      </div>

      <form onSubmit={handleCreate} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-sm">
          <span className="text-muted-foreground">Название</span>
          <Input
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) setSlug(slugify(e.target.value));
            }}
            placeholder="Например: Английский язык"
          />
        </label>
        <label className="w-full space-y-1 text-sm sm:w-48">
          <span className="text-muted-foreground">Slug</span>
          <Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="english" />
        </label>
        <Button type="submit">
          <Plus className="h-4 w-4" /> Создать
        </Button>
      </form>

      {loading ? (
        <p className="text-sm text-muted-foreground">Загрузка…</p>
      ) : (
        <ResponsiveTable
          columns={columns}
          rows={rows}
          empty="Предметов пока нет"
          getRowKey={(row) => row.id}
          cardTitle={(row) => `📚 ${row.name}`}
        />
      )}

      {detail ? (
        <div className="rounded-lg border border-border bg-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold">{detail.name}</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Чат: {detail.chatTitle || detail.chat_title || '—'}
          </p>
          <p className="mt-1 flex items-center gap-1 text-sm text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            Участников: {detail.memberCount ?? detail.member_count ?? 0}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Преподавателей: {(detail.teacherIds || detail.teacher_ids || []).length}
            {' · '}
            Репетиторов: {(detail.tutorIds || detail.tutor_ids || []).length}
            {' · '}
            Курсов: {(detail.courseTemplateIds || detail.course_template_ids || []).length}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3"
            onClick={() => setSelectedId(null)}
          >
            Закрыть
          </Button>
        </div>
      ) : null}
    </PageShell>
  );
}
