import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { QUESTION_TYPE_LABEL } from '@/lib/assessment-admin';

export default function BlueprintPreviewDialog({
  open,
  onOpenChange,
  preview,
  sections = [],
  loading = false,
  blueprintName = '',
}) {
  const sectionMeta = new Map(
    sections.map((s) => [s.section_key || s.sectionKey, s]),
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Предпросмотр структуры экзамена</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-4">
            {blueprintName ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{blueprintName}</p>
            ) : null}

            {preview && (
              <div
                className={`rounded-xl px-3 py-2 text-sm ${
                  preview.ok
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200'
                    : 'bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                }`}
              >
                {preview.ok
                  ? 'Пул вопросов достаточен для всех секций'
                  : 'Есть проблемы с набором вопросов'}
              </div>
            )}

            <div className="space-y-2">
              <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Структура экзамена
              </h4>
              {(preview?.sections || sections).length === 0 ? (
                <p className="text-sm text-slate-500">Секций нет</p>
              ) : (
                <ul className="space-y-2">
                  {(preview?.sections || []).map((row) => {
                    const key = row.section_key || row.sectionKey;
                    const meta = sectionMeta.get(key);
                    const type =
                      meta?.question_type ||
                      meta?.question_types?.[0] ||
                      '—';
                    return (
                      <li
                        key={key}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm"
                      >
                        <p className="font-medium text-slate-900 dark:text-white">
                          {meta?.title || key}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                          Тип: {QUESTION_TYPE_LABEL[type] || 'Вопрос'} · Запрошено:{' '}
                          {row.requested ?? meta?.question_count} · Доступно:{' '}
                          {row.available ?? '—'}
                          {meta?.weight != null ? ` · Вес: ${meta.weight}%` : ''}
                        </p>
                      </li>
                    );
                  })}
                  {!preview?.sections?.length &&
                    sections.map((meta) => (
                      <li
                        key={meta.local_id || meta.section_key}
                        className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 text-sm"
                      >
                        <p className="font-medium text-slate-900 dark:text-white">
                          {meta.title || meta.section_key}
                        </p>
                        <p className="text-slate-500 dark:text-slate-400 mt-1">
                          Тип:{' '}
                          {QUESTION_TYPE_LABEL[
                            meta.question_type || meta.question_types?.[0]
                          ] || '—'}{' '}
                          · Вопросов: {meta.question_count} · Вес: {meta.weight}%
                        </p>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            {Array.isArray(preview?.errors) && preview.errors.length > 0 && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-3 text-sm text-rose-800 dark:text-rose-200 space-y-1">
                {preview.errors.map((err) => (
                  <p key={err}>{err}</p>
                ))}
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Закрыть
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
