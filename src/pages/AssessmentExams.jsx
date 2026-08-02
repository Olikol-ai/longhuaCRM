import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  Eye,
  Loader2,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import ExamCreateDialog from '@/components/assessment/ExamCreateDialog';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { useAssessmentExams } from '@/hooks/useAssessmentExams';
import { useAuth } from '@/lib/AuthContext';
import { formatDateTime, unwrapItems } from '@/lib/assessment-admin';

export default function AssessmentExams() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const [authorFilter, setAuthorFilter] = useState('');
  const [ownerNames, setOwnerNames] = useState({});
  const { exams, loading, error, reload } = useAssessmentExams({
    status: statusFilter,
    search: searchApplied,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    if (!isAdmin) return undefined;
    let cancelled = false;
    (async () => {
      try {
        const rows = await api.users.directory();
        const list = Array.isArray(rows) ? rows : unwrapItems(rows);
        const next = {};
        for (const u of list) {
          if (!u?.id) continue;
          next[u.id] =
            u.full_name ||
            [u.first_name, u.last_name].filter(Boolean).join(' ') ||
            u.email ||
            u.id.slice(0, 8);
        }
        if (!cancelled) setOwnerNames(next);
      } catch {
        /* directory optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  const authorOptions = useMemo(() => {
    const ids = new Set(
      exams.map((e) => e.created_by_user_id).filter(Boolean),
    );
    return [...ids].map((id) => ({
      id,
      name: ownerNames[id] || id.slice(0, 8),
    }));
  }, [exams, ownerNames]);

  const visibleExams = useMemo(() => {
    if (!authorFilter) return exams;
    return exams.filter((e) => e.created_by_user_id === authorFilter);
  }, [exams, authorFilter]);

  const goDetail = (id) => {
    navigate(`${createPageUrl('AssessmentExamDetail')}?id=${encodeURIComponent(id)}`);
  };

  const handlePublish = async (exam) => {
    setBusyId(exam.id);
    try {
      await api.assessment.publishExam(exam.id);
      toast({ title: 'Экзамен опубликован' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось опубликовать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleArchive = async () => {
    if (!confirmArchive) return;
    setBusyId(confirmArchive.id);
    try {
      await api.assessment.archiveExam(confirmArchive.id);
      toast({ title: 'Экзамен архивирован' });
      setConfirmArchive(null);
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось архивировать',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Экзамены</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {isAdmin
              ? 'Все экзамены всех авторов: наборы заданий и публикация'
              : 'При старте экзамена вопросы подбираются случайно из вашего набора'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            size="sm"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать экзамен
          </Button>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2">
        <Input
          placeholder="Поиск по названию…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') setSearchApplied(search.trim());
          }}
        />
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-48"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="published">Опубликован</option>
          <option value="archived">В архиве</option>
        </select>
        {isAdmin && (
          <select
            className="h-10 rounded-md border border-input bg-background px-3 text-sm sm:w-56"
            value={authorFilter}
            onChange={(e) => setAuthorFilter(e.target.value)}
          >
            <option value="">Все авторы</option>
            {authorOptions.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        )}
        <Button variant="outline" onClick={() => setSearchApplied(search.trim())}>
          Найти
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Ошибка загрузки</p>
          <p className="mt-1">{error.message}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-brand" />
        </div>
      ) : visibleExams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Экзаменов пока нет
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Создайте экзамен из вопросов и заданий на аудирование и чтение.
          </p>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать экзамен
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {visibleExams.map((exam) => {
            const authorName = exam.created_by_user_id
              ? ownerNames[exam.created_by_user_id] || exam.created_by_user_id.slice(0, 8)
              : null;
            return (
              <article
                key={exam.id}
                className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                        {exam.name}
                      </h2>
                      <LifecycleBadge status={exam.status} />
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      Случайный набор вопросов при старте экзамена
                    </p>
                    <p className="text-xs text-slate-400">
                      Создан: {formatDateTime(exam.created_at)}
                      {isAdmin && authorName ? ` · Автор: ${authorName}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm" onClick={() => goDetail(exam.id)}>
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      {exam.status === 'archived' ? 'Просмотр' : 'Открыть'}
                    </Button>
                    {exam.status === 'draft' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === exam.id}
                        onClick={() => handlePublish(exam)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Опубликовать
                      </Button>
                    )}
                    {exam.status !== 'archived' && (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === exam.id}
                        onClick={() => setConfirmArchive(exam)}
                      >
                        <Archive className="h-3.5 w-3.5 mr-1" />
                        В архив
                      </Button>
                    )}
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <ExamCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          toast({ title: 'Экзамен создан' });
          goDetail(created.id);
        }}
      />

      <AlertDialog
        open={Boolean(confirmArchive)}
        onOpenChange={(o) => !o && setConfirmArchive(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать экзамен?</AlertDialogTitle>
            <AlertDialogDescription>
              «{confirmArchive?.name}» будет архивирован — новые попытки будут закрыты.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={!!busyId} onClick={handleArchive}>
              {busyId ? 'Архивирование…' : 'Архивировать'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
