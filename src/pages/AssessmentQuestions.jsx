import { useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Archive,
  Download,
  Eye,
  FileQuestion,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Upload,
} from 'lucide-react';
import { api } from '@/api';
import LifecycleBadge from '@/components/assessment/LifecycleBadge';
import QuestionFormDialog from '@/components/assessment/QuestionFormDialog';
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
import { useAssessmentBanks } from '@/hooks/useAssessmentBanks';
import { useAssessmentQuestions } from '@/hooks/useAssessmentQuestions';
import { useAuth } from '@/lib/AuthContext';
import {
  QUESTION_TYPE_LABEL,
  QUESTION_TYPES,
  formatDateTime,
} from '@/lib/assessment-admin';

export default function AssessmentQuestions() {
  const { user } = useAuth();
  const assessmentHomePage = user?.role === 'admin' ? 'AdminAssessment' : 'AssessmentExams';
  const [bankId, setBankId] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [searchApplied, setSearchApplied] = useState('');

  const { banks } = useAssessmentBanks();
  const { questions, loading, error, reload, removeQuestion } = useAssessmentQuestions({
    bankId,
    type,
    status,
    search: searchApplied,
  });

  const isAdmin = user?.role === 'admin';
  const canDeleteQuestion = (question) =>
    isAdmin ||
    (Boolean(user?.id) &&
      Boolean(question?.created_by_user_id) &&
      question.created_by_user_id === user.id);

  const bankNameById = useMemo(() => {
    const map = new Map();
    banks.forEach((b) => map.set(b.id, b.name));
    return map;
  }, [banks]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const [editing, setEditing] = useState(null);
  const [dialogMode, setDialogMode] = useState('create');
  const [confirmAction, setConfirmAction] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const openCreate = () => {
    setEditing(null);
    setDialogMode('create');
    setDialogOpen(true);
  };

  const openEdit = (question, mode = 'edit') => {
    setEditing(question);
    setDialogMode(mode);
    setDialogOpen(true);
  };

  const runLifecycle = async (event) => {
    event?.preventDefault?.();
    const action = confirmAction;
    if (!action?.question) return;
    const { question, type: actionType } = action;
    setBusyId(question.id);
    try {
      if (actionType === 'publish') {
        await api.assessment.publishQuestion(question.id);
        toast({ title: 'Вопрос опубликован' });
        setConfirmAction(null);
        reload();
      } else if (actionType === 'archive') {
        await api.assessment.archiveQuestion(question.id);
        toast({ title: 'Вопрос архивирован' });
        setConfirmAction(null);
        reload();
      } else if (actionType === 'delete') {
        await api.assessment.deleteQuestion(question.id);
        setConfirmAction(null);
        removeQuestion(question.id);
        toast({ title: 'Вопрос успешно удалён.' });
      }
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

  const confirmCopy = {
    publish: {
      title: 'Опубликовать вопрос?',
      description: 'После публикации вопрос станет доступен для экзаменов.',
      confirmLabel: 'Подтвердить',
    },
    archive: {
      title: 'Архивировать вопрос?',
      description: 'Вопрос будет переведён в архив и недоступен для новых экзаменов.',
      confirmLabel: 'Подтвердить',
    },
    delete: {
      title: 'Удалить вопрос?',
      description: 'Это действие нельзя отменить.',
      confirmLabel: 'Удалить',
    },
  };

  const handleExport = () => {
    if (!bankId) {
      toast({
        title: 'Сначала выберите банк',
        description: 'Экспорт выполняется для конкретного банка вопросов.',
        variant: 'destructive',
      });
      return;
    }
    const payload = {
      version: 1,
      bank_id: bankId,
      exported_at: new Date().toISOString(),
      questions: questions.map((question) => ({
        type: question.type,
        stem: question.stem,
        points: question.points,
        difficulty: question.difficulty,
        explanation: question.explanation,
        answers: (question.answers || []).map((answer) => ({
          text: answer.text || answer.body,
          is_correct: Boolean(answer.is_correct),
          sort_order: answer.sort_order,
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `assessment-bank-${bankId}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!bankId) {
      toast({
        title: 'Сначала выберите банк',
        description: 'Импорт выполняется в выбранный банк вопросов.',
        variant: 'destructive',
      });
      return;
    }
    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw);
      const importedQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
      if (!Array.isArray(importedQuestions) || importedQuestions.length === 0) {
        throw new Error('Файл не содержит вопросов');
      }
      setBusyId(`import:${bankId}`);
      for (const item of importedQuestions) {
        await api.assessment.createQuestion({
          bank_id: bankId,
          type: item.type,
          stem: item.stem,
          points: item.points,
          difficulty: item.difficulty,
          explanation: item.explanation,
          answers: (item.answers || []).map((answer) => ({
            text: answer.text || answer.body,
            is_correct: Boolean(answer.is_correct),
            sort_order: answer.sort_order,
          })),
        });
      }
      toast({ title: 'Вопросы импортированы' });
      reload();
    } catch (err) {
      toast({
        title: 'Не удалось импортировать',
        description: err?.message || 'Проверьте формат JSON файла.',
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Link
            to={createPageUrl(assessmentHomePage)}
            className="text-xs text-slate-500 hover:text-brand dark:hover:text-brand"
          >
            ← Экзамены
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mt-1">
            Вопросы
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Создание и фильтрация вопросов
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => reload()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Обновить
          </Button>
          <Button variant="outline" size="sm" onClick={handleExport} disabled={!bankId || questions.length === 0}>
            <Download className="h-4 w-4 mr-2" />
            Экспорт
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={!bankId || busyId === `import:${bankId}`}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-4 w-4 mr-2" />
            Импорт
          </Button>
          <Button
            className="bg-primary hover:bg-primary/90"
            size="sm"
            onClick={openCreate}
            disabled={banks.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать вопрос
          </Button>
        </div>
      </div>

      {banks.length === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-sm text-amber-800 dark:text-amber-200">
          Сначала создайте банк вопросов в разделе{' '}
          <Link
            to={createPageUrl('AssessmentBanks')}
            className="font-semibold underline"
          >
            Банки вопросов
          </Link>
          .
        </div>
      )}
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={handleImportFile}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div className="relative sm:col-span-2 lg:col-span-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Поиск по тексту…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') setSearchApplied(search.trim());
            }}
          />
        </div>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={bankId}
          onChange={(e) => setBankId(e.target.value)}
        >
          <option value="">Все банки</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={type}
          onChange={(e) => setType(e.target.value)}
        >
          <option value="">Все типы</option>
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {QUESTION_TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="published">Опубликован</option>
          <option value="archived">В архиве</option>
        </select>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setSearchApplied(search.trim())}
      >
        Применить фильтры
      </Button>

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
      ) : questions.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-10 text-center space-y-3">
          <FileQuestion className="h-10 w-10 mx-auto text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
            Вопросов не найдено
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Измените фильтры или создайте новый вопрос.
          </p>
          <Button
            className="bg-primary hover:bg-primary/90"
            onClick={openCreate}
            disabled={banks.length === 0}
          >
            <Plus className="h-4 w-4 mr-2" />
            Создать вопрос
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {questions.map((q) => (
            <article
              key={q.id}
              className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0 space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs rounded-full px-2 py-0.5 bg-brand-soft dark:bg-brand-soft/40 text-brand dark:text-brand">
                      {QUESTION_TYPE_LABEL[q.type] || q.type}
                    </span>
                    <LifecycleBadge status={q.status} />
                    <span className="text-xs text-slate-400">
                      {bankNameById.get(q.bank_id) || 'Банк'}
                    </span>
                  </div>
                  <p className="text-sm sm:text-base text-slate-900 dark:text-white line-clamp-3 whitespace-pre-wrap">
                    {q.stem}
                  </p>
                  <p className="text-xs text-slate-400">
                    {q.points != null ? `${q.points} балл(ов) · ` : ''}
                    Сложность {q.difficulty ?? '—'} ·{' '}
                    {formatDateTime(q.updated_at || q.created_at)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  {q.status === 'draft' ? (
                    <>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === q.id}
                        onClick={() => openEdit(q, 'edit')}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Изменить
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === q.id}
                        onClick={() =>
                          setConfirmAction({ type: 'publish', question: q })
                        }
                      >
                        <Send className="h-3.5 w-3.5 mr-1" />
                        Опубликовать
                      </Button>
                    </>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(q, 'edit')}
                    >
                      <Eye className="h-3.5 w-3.5 mr-1" />
                      Просмотр
                    </Button>
                  )}
                  {canDeleteQuestion(q) && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-rose-600"
                      disabled={busyId === q.id}
                      onClick={() =>
                        setConfirmAction({ type: 'delete', question: q })
                      }
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Удалить
                    </Button>
                  )}
                  {q.status !== 'archived' && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busyId === q.id}
                      onClick={() =>
                        setConfirmAction({ type: 'archive', question: q })
                      }
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

      <QuestionFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        mode={dialogMode}
        question={editing}
        banks={banks}
        defaultBankId={bankId}
        onSaved={() => {
          toast({
            title: editing ? 'Вопрос обновлён' : 'Вопрос создан',
          });
          reload();
        }}
      />

      <AlertDialog
        open={Boolean(confirmAction)}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmCopy[confirmAction?.type]?.title || 'Подтвердите действие'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmCopy[confirmAction?.type]?.description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={!!busyId} onClick={runLifecycle}>
              {busyId
                ? 'Выполнение…'
                : confirmCopy[confirmAction?.type]?.confirmLabel || 'Подтвердить'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
