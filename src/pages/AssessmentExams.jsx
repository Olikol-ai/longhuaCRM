import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
import { useAuth } from '@/lib/AuthContext';
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
import { formatDateTime } from '@/lib/assessment-admin';

export default function AssessmentExams() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assessmentHomePage = user?.role === 'admin' ? 'AdminAssessment' : 'AssessmentBanks';
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');
  const { exams, loading, error, reload } = useAssessmentExams({
    status: statusFilter,
    search: searchApplied,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [busyId, setBusyId] = useState(null);

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
          <Link
            to={createPageUrl(assessmentHomePage)}
            className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
          >
            ← Назад
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Экзамены
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Создание экзамена из опубликованной структуры
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
      ) : exams.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Экзаменов пока нет
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Создайте экзамен из опубликованной структуры — вопросы подбираются
            автоматически.
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
          {exams.map((exam) => (
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
                    Блоки → Экзамен
                  </p>
                  <p className="text-xs text-slate-400">
                    Создан: {formatDateTime(exam.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => goDetail(exam.id)}>
                    <Eye className="h-3.5 w-3.5 mr-1" />
                    {exam.status === 'draft' ? 'Открыть' : 'Просмотр'}
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
          ))}
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
              {busyId ? "Архивирование…" : "Архивировать"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
