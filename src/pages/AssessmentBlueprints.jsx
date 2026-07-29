import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  Eye,
  Loader2,
  Network,
  Pencil,
  Plus,
  RefreshCw,
  Send,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import BlueprintCreateDialog from '@/components/assessment/BlueprintCreateDialog';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import { Button } from '@/components/ui/button';
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
import { useAssessmentBlueprints } from '@/hooks/useAssessmentBlueprints';
import { canPublishBlueprint, formatDateTime } from '@/lib/assessment-admin';

export default function AssessmentBlueprints() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assessmentHomePage = user?.role === 'admin' ? 'AdminAssessment' : 'AssessmentExams';
  const [statusFilter, setStatusFilter] = useState('');
  const { blueprints, loading, error, reload } = useAssessmentBlueprints({
    status: statusFilter,
  });
  const [createOpen, setCreateOpen] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const goEdit = (id) => {
    navigate(`${createPageUrl('AssessmentBlueprintEdit')}?id=${encodeURIComponent(id)}`);
  };

  const handlePublish = async (bp) => {
    const check = canPublishBlueprint(bp.section_rules || []);
    if (!check.ok) {
      toast({
        title: 'Нельзя опубликовать',
        description: check.reason,
        variant: 'destructive',
      });
      return;
    }
    setBusyId(bp.id);
    try {
      await api.assessment.publishBlueprint(bp.id);
      toast({ title: 'Структура экзамена опубликована' });
      reload();
    } catch (err) {
      toast({
        title: 'Ошибка публикации',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const runConfirm = async () => {
    if (!confirm?.blueprint) return;
    const { blueprint, type } = confirm;
    setBusyId(blueprint.id);
    try {
      if (type === 'archive') {
        await api.assessment.archiveBlueprint(blueprint.id);
        toast({ title: 'Структура экзамена архивирована' });
      } else if (type === 'delete') {
        await api.assessment.deleteBlueprint(blueprint.id);
        toast({ title: 'Структура экзамена удалена' });
      }
      setConfirm(null);
      reload();
    } catch (err) {
      toast({
        title: 'Операция не выполнена',
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
            ← Экзамены
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Структура экзамена
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Секции, типы вопросов и веса
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
            Создать структуру
          </Button>
        </div>
      </div>

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
      ) : blueprints.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <Network className="h-10 w-10 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Структур экзамена пока нет
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Создайте структуру экзамена с секциями Аудирование / Чтение и весами.
          </p>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать структуру
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {blueprints.map((bp) => (
            <article
              key={bp.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-slate-900 dark:text-white truncate">
                      {bp.name}
                    </h2>
                    <LifecycleBadge status={bp.status} />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-slate-400">
                    Секций: {bp.section_count ?? bp.section_rules?.length ?? 0}
                  </p>
                  <p className="text-xs text-slate-400">
                    Создан: {formatDateTime(bp.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => goEdit(bp.id)}>
                    {bp.status === 'draft' ? (
                      <>
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Редактор
                      </>
                    ) : (
                      <>
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Просмотр
                      </>
                    )}
                  </Button>
                  {bp.status === 'draft' && (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === bp.id}
                        onClick={() => handlePublish(bp)}
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Опубликовать
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-rose-600"
                        disabled={busyId === bp.id}
                        onClick={() => setConfirm({ type: 'delete', blueprint: bp })}
                      >
                        Удалить
                      </Button>
                    </>
                  )}
                  {bp.status !== 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === bp.id}
                      onClick={() => setConfirm({ type: 'archive', blueprint: bp })}
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

      <BlueprintCreateDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        onCreated={(created) => {
          toast({ title: 'Структура экзамена создана' });
          goEdit(created.id);
        }}
      />

      <AlertDialog open={Boolean(confirm)} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirm?.type === 'delete'
                ? 'Удалить структуру экзамена?'
                : 'Архивировать структуру экзамена?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.type === 'delete'
                ? 'Удаление доступно только для черновиков.'
                : `Структура «${confirm?.blueprint?.name}» будет архивирована.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={!!busyId} onClick={runConfirm}>
              {busyId ? "Выполнение…" : "Подтвердить"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
