import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { cn } from '@/lib/utils';

export default function HskAcademyResult() {
  const [params] = useSearchParams();
  const sessionId = params.get('sessionId') || '';
  const [payload, setPayload] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!sessionId) return;
    api.examAcademy.sessions
      .result(sessionId)
      .then(setPayload)
      .catch((err) => setError(userFacingError(err)));
  }, [sessionId]);

  const result = payload?.result;
  const items = payload?.items || [];
  // Prefer a breakdown list that actually contains objects. Top-level `breakdowns`
  // used to be nullified by JSON cycle-breaking when the API returned entity refs twice.
  const breakdowns = (() => {
    const candidates = [payload?.breakdowns, result?.breakdowns];
    for (const list of candidates) {
      if (!Array.isArray(list)) continue;
      const cleaned = list.filter((b) => b && typeof b === 'object');
      if (cleaned.length > 0 || list.length === 0) return cleaned;
    }
    return [];
  })();
  const percent = Number(result?.percent) || 0;
  const score = result?.score;
  const maxScore = result?.max_score ?? result?.maxScore;
  const duration = result?.duration;
  const avgTimeMs =
    result?.avg_answer_time_ms ??
    result?.avgAnswerTimeMs ??
    payload?.avg_answer_time_ms ??
    null;

  const words = useMemo(() => {
    const map = new Map();
    for (const item of items) {
      for (const w of item.vocabulary || []) {
        if (!w.word) continue;
        map.set(`${w.word}|${w.pinyin || ''}`, w);
      }
    }
    return [...map.values()];
  }, [items]);

  const wrongCount = items.filter((i) => i.is_correct === false).length;
  const maxBreakdown = Math.max(
    1,
    ...breakdowns.map((b) => Number(b.maxScore || b.max_score || 0) || 0),
  );

  const saveWord = async (w) => {
    try {
      await api.examAcademy.me.addWord({
        word: w.word,
        pinyin: w.pinyin,
        translation: w.translation,
        explanation: w.explanation,
      });
      toast({ title: `«${w.word}» добавлено в словарь` });
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const addFavorite = async (item) => {
    if (!item.source_question_id) return;
    try {
      await api.examAcademy.me.addFavorite({
        content_kind: 'question',
        content_id: item.source_question_id,
      });
      toast({ title: 'Задание добавлено в избранное' });
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  return (
    <HskAcademyShell
      active="prep"
      title="Результат"
      description="Итог попытки, разбор по разделам и следующие шаги."
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Card className="p-4 sm:p-5 border-border overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4 sm:gap-8">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Результат</p>
            <p className="text-4xl sm:text-5xl font-bold tabular-nums text-foreground tracking-tight mt-1">
              {percent}
              <span className="text-2xl sm:text-3xl text-muted-foreground font-semibold">%</span>
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {score ?? '—'} / {maxScore ?? '—'} баллов
            </p>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-6 flex-1 min-w-0">
            {[
              [
                'Время',
                duration != null ? `${Math.max(1, Math.round(duration / 60))} мин` : '—',
              ],
              [
                'Ср. ответ',
                avgTimeMs != null ? `${Math.round(Number(avgTimeMs) / 1000)} с` : '—',
              ],
              ['Ошибки', String(wrongCount)],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0">
                <p className="text-xs text-muted-foreground truncate">{label}</p>
                <p className="text-lg font-semibold tabular-nums mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>
      </Card>

      {breakdowns.length > 0 ? (
        <Card className="p-4 border-border space-y-3">
          <h3 className="text-sm font-medium">По разделам</h3>
          <ul className="space-y-2.5">
            {breakdowns.map((b) => {
              const sc = Number(b.score) || 0;
              const mx = Number(b.maxScore || b.max_score) || 0;
              const pct = mx > 0 ? Math.round((sc / mx) * 100) : 0;
              return (
                <li key={b.id || b.sectionKey || b.section_key}>
                  <div className="flex justify-between gap-2 text-sm mb-1">
                    <span className="truncate text-foreground">{b.title || b.sectionKey || b.section_key}</span>
                    <strong className="shrink-0 tabular-nums">
                      {sc}/{mx || '—'}
                    </strong>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className="h-full bg-brand transition-[width]"
                      style={{ width: `${pct}%`, maxWidth: '100%' }}
                      aria-hidden
                    />
                  </div>
                </li>
              );
            })}
          </ul>
          <span className="sr-only">max scale {maxBreakdown}</span>
        </Card>
      ) : null}

      <div className="flex flex-col sm:flex-row flex-wrap gap-2">
        <Button asChild className="min-h-11 w-full sm:w-auto">
          <Link to={createPageUrl('HskAcademy')}>В Academy</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link to={createPageUrl('HskAcademyPractice')}>Повторить тренировку</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link to={createPageUrl('HskAcademyMock')}>Новый вариант</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11 w-full sm:w-auto">
          <Link to={`${createPageUrl('HskAcademyPractice')}?mode=error_review`}>
            Ошибки
          </Link>
        </Button>
        <Button asChild variant="ghost" className="min-h-11 w-full sm:w-auto">
          <Link to={createPageUrl('HskAcademyPreparation')}>Подготовка</Link>
        </Button>
      </div>

      {words.length > 0 ? (
        <Card className="p-4 border-border space-y-3">
          <h3 className="text-sm font-medium">Новые слова</h3>
          <ul className="divide-y divide-border">
            {words.map((w) => (
              <li
                key={`${w.word}-${w.pinyin}`}
                className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <strong className="text-sm">{w.word}</strong>
                  {w.pinyin ? (
                    <span className="text-muted-foreground text-sm"> · {w.pinyin}</span>
                  ) : null}
                  {w.translation ? (
                    <div className="text-xs text-muted-foreground truncate">{w.translation}</div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-10 shrink-0"
                  onClick={() => saveWord(w)}
                >
                  В словарь
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      {items.length > 0 ? (
        <div className="space-y-3">
          <h3 className="text-sm font-medium px-0.5">Разбор заданий</h3>
          <div className="space-y-2">
            {items.map((item, idx) => (
              <article
                key={item.snapshot_id}
                className="rounded-lg border border-border bg-card p-3 sm:p-4 space-y-2.5"
              >
                <header className="flex justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">№{idx + 1}</span>
                  <strong
                    className={cn(
                      item.is_correct === false && 'text-destructive',
                      item.is_correct && 'text-emerald-600 dark:text-emerald-400',
                    )}
                  >
                    {item.is_correct === false
                      ? 'Ошибка'
                      : item.is_correct
                        ? 'Верно'
                        : '—'}
                  </strong>
                </header>
                <p className="text-sm whitespace-pre-wrap leading-snug">{item.stem}</p>
                <ul className="space-y-1.5">
                  {(item.answers || []).map((a) => (
                    <li
                      key={a.id}
                      className={cn(
                        'text-sm rounded-md border px-3 py-2',
                        a.is_correct && 'border-emerald-500/40 bg-emerald-500/10',
                        a.selected && !a.is_correct && 'border-destructive/40 bg-destructive/10',
                        !a.selected && !a.is_correct && 'border-border/80',
                      )}
                    >
                      {a.text}
                    </li>
                  ))}
                </ul>
                {item.explanation ? (
                  <p className="text-sm text-muted-foreground leading-snug">{item.explanation}</p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-10 -ml-2"
                  onClick={() => addFavorite(item)}
                >
                  В избранное
                </Button>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </HskAcademyShell>
  );
}
