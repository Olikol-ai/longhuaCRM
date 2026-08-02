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
  const breakdowns = payload?.breakdowns || result?.breakdowns || [];
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
    <HskAcademyShell active="prep">
      <div>
        <h2 className="text-xl font-semibold">Результат</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Баллы, разбор по разделам и действия после экзамена.
        </p>
      </div>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          ['Баллы', `${score ?? '—'} / ${maxScore ?? '—'}`],
          ['Процент', `${percent}%`],
          [
            'Время',
            duration != null ? `${Math.max(1, Math.round(duration / 60))} мин` : '—',
          ],
          [
            'Ср. время',
            avgTimeMs != null ? `${Math.round(Number(avgTimeMs) / 1000)} с` : '—',
          ],
          ['Ошибки', String(wrongCount)],
        ].map(([label, value]) => (
          <Card key={label} className="p-3 border-border">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-lg font-semibold mt-1">{value}</p>
          </Card>
        ))}
      </div>

      {breakdowns.length > 0 ? (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">По разделам</h3>
          <ul className="space-y-3">
            {breakdowns.map((b) => {
              const sc = Number(b.score) || 0;
              const mx = Number(b.maxScore || b.max_score) || 0;
              const pct = mx > 0 ? Math.round((sc / mx) * 100) : 0;
              return (
                <li key={b.id || b.sectionKey || b.section_key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span>{b.title || b.sectionKey || b.section_key}</span>
                    <strong>
                      {sc} / {mx || '—'}
                    </strong>
                  </div>
                  <div className="h-2 rounded-full bg-muted overflow-hidden">
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

      {words.length > 0 ? (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Новые слова</h3>
          <ul className="space-y-2">
            {words.map((w) => (
              <li
                key={`${w.word}-${w.pinyin}`}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <div>
                  <strong>{w.word}</strong>
                  {w.pinyin ? (
                    <span className="text-muted-foreground text-sm"> · {w.pinyin}</span>
                  ) : null}
                  {w.translation ? (
                    <div className="text-sm text-muted-foreground">{w.translation}</div>
                  ) : null}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="min-h-11"
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
        <Card className="p-4 space-y-4 border-border">
          <h3 className="font-medium">Разбор заданий</h3>
          <div className="space-y-4">
            {items.map((item, idx) => (
              <article
                key={item.snapshot_id}
                className="rounded-md border border-border p-3 space-y-2"
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
                <p className="text-sm whitespace-pre-wrap">{item.stem}</p>
                <ul className="space-y-1">
                  {(item.answers || []).map((a) => (
                    <li
                      key={a.id}
                      className={cn(
                        'text-sm rounded-md border px-3 py-2',
                        a.is_correct && 'border-emerald-500/50 bg-emerald-500/10',
                        a.selected && !a.is_correct && 'border-destructive/50 bg-destructive/10',
                        !a.selected && !a.is_correct && 'border-border',
                      )}
                    >
                      {a.text}
                    </li>
                  ))}
                </ul>
                {item.explanation ? (
                  <p className="text-sm text-muted-foreground">{item.explanation}</p>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="min-h-11"
                  onClick={() => addFavorite(item)}
                >
                  В избранное
                </Button>
              </article>
            ))}
          </div>
        </Card>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button asChild className="min-h-11">
          <Link to={createPageUrl('HskAcademy')}>В Academy</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to={createPageUrl('HskAcademyPractice')}>Повторить тренировку</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to={createPageUrl('HskAcademyMock')}>Новый вариант</Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to={`${createPageUrl('HskAcademyPractice')}?mode=error_review`}>
            Ошибки
          </Link>
        </Button>
        <Button asChild variant="outline" className="min-h-11">
          <Link to={createPageUrl('HskAcademyPreparation')}>Словарь / подготовка</Link>
        </Button>
      </div>
    </HskAcademyShell>
  );
}
