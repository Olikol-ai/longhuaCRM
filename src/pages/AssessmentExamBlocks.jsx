import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Archive,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Trash2,
} from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
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
import { useAssessmentExamBlocks } from '@/hooks/useAssessmentExamBlocks';
import { formatDateTime } from '@/lib/assessment-admin';

export default function AssessmentExamBlocks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const assessmentHomePage = user?.role === 'admin' ? 'AdminAssessment' : 'AssessmentBanks';
  const [statusFilter, setStatusFilter] = useState('');
  const { blocks, loading, error, reload } = useAssessmentExamBlocks({
    status: statusFilter,
  });
  const [confirmArchive, setConfirmArchive] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const sorted = useMemo(
    () =>
      [...blocks].sort((a, b) => {
        const ta = new Date(b.updated_at || b.created_at || 0).getTime();
        const tb = new Date(a.updated_at || a.created_at || 0).getTime();
        return ta - tb;
      }),
    [blocks],
  );

  const goEdit = (id) => {
    navigate(`${createPageUrl('AssessmentExamBlockEdit')}?id=${encodeURIComponent(id)}`);
  };

  const handleCreate = async () => {
    setBusyId('create');
    try {
      const created = await api.assessment.createExamBlock({
        name: 'Новый блок',
        question_ids: [],
      });
      toast({ title: 'Блок создан' });
      goEdit(created.id);
    } catch (err) {
      toast({
        title: 'Не удалось создать блок',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handlePublish = async (block) => {
    setBusyId(block.id);
    try {
      await api.assessment.publishExamBlock(block.id);
      toast({ title: 'Блок активирован' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось активировать',
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
      await api.assessment.archiveExamBlock(confirmArchive.id);
      toast({ title: 'Блок архивирован' });
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

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    try {
      const result = await api.assessment.deleteExamBlock(confirmDelete.id);
      toast({
        title: result?.mode === 'soft' ? 'Блок архивирован' : 'Блок удалён',
        description:
          result?.mode === 'soft'
            ? 'Блок уже использовался в экзамене, поэтому архивирован.'
            : undefined,
      });
      setConfirmDelete(null);
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось удалить',
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
            Блоки экзаменов
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Вопрос → Блок → Экзамен. Соберите вопросы в блок, активируйте и используйте в экзамене.
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
            onClick={handleCreate}
            disabled={busyId === 'create'}
          >
            {busyId === 'create' ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            Создать блок
          </Button>
        </div>
      </div>

      <div className="flex gap-2">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="published">Активен</option>
          <option value="archived">В архиве</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-brand" />
        </div>
      ) : error ? (
        <p className="text-sm text-rose-600" role="alert">
          {error.message || 'Ошибка загрузки'}
        </p>
      ) : sorted.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-700 p-10 text-center">
          <Layers className="h-10 w-10 mx-auto text-slate-400 mb-3" />
          <p className="text-slate-600 dark:text-slate-300">Пока нет блоков</p>
          <Button className="mt-4" size="sm" onClick={handleCreate}>
            Создать первый блок
          </Button>
        </div>
      ) : (
        <ul className="space-y-3">
          {sorted.map((block) => {
            const itemCount = block.items?.length ?? block.question_ids?.length ?? 0;
            return (
              <li
                key={block.id}
                className="rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="font-semibold text-slate-900 dark:text-white truncate">
                      {block.name}
                    </h2>
                    <LifecycleBadge status={block.status} />
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    {itemCount} вопр.
                    {block.level_label ? ` · ${block.level_label}` : ''}
                    {block.duration_minutes ? ` · ${block.duration_minutes} мин` : ''}
                    {' · '}
                    {formatDateTime(block.updated_at || block.created_at)}
                  </p>
                  {block.description ? (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">
                      {block.description}
                    </p>
                  ) : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => goEdit(block.id)}>
                    <Pencil className="h-4 w-4 mr-1" />
                    {block.status === 'draft' ? 'Редактировать' : 'Открыть'}
                  </Button>
                  {block.status === 'draft' && (
                    <Button
                      size="sm"
                      className="bg-primary hover:bg-primary/90"
                      disabled={busyId === block.id}
                      onClick={() => handlePublish(block)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Активировать
                    </Button>
                  )}
                  {block.status !== 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === block.id}
                      onClick={() => setConfirmArchive(block)}
                    >
                      <Archive className="h-4 w-4 mr-1" />
                      Архив
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busyId === block.id}
                    onClick={() => setConfirmDelete(block)}
                  >
                    <Trash2 className="h-4 w-4 mr-1" />
                    Удалить
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <AlertDialog open={Boolean(confirmArchive)} onOpenChange={(o) => !o && setConfirmArchive(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Архивировать блок?</AlertDialogTitle>
            <AlertDialogDescription>
              Блок «{confirmArchive?.name}» станет недоступен для новых экзаменов.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Архивировать</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={Boolean(confirmDelete)} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить блок?</AlertDialogTitle>
            <AlertDialogDescription>
              Если блок уже использовался в экзамене, он будет архивирован вместо удаления.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
