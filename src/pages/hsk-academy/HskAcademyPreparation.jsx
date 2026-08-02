import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/use-toast';

const MODE_LABEL = {
  practice: 'Тренировка',
  mock_exam: 'Пробный',
  random_exam: 'Случайный',
  error_review: 'Ошибки',
  favorites: 'Избранное',
};

const STATUS_LABEL = {
  in_progress: 'В процессе',
  completed: 'Завершён',
  expired: 'Просрочен',
};

function historyStatus(row) {
  return row.display_status || row.displayStatus || row.status;
}

const TABS = [
  { id: 'history', label: 'История', short: 'История' },
  { id: 'dynamics', label: 'Динамика', short: 'Динамика' },
  { id: 'dictionary', label: 'Словарь', short: 'Словарь' },
  { id: 'favorites', label: 'Избранное', short: 'Избранное' },
  { id: 'review', label: 'Ошибки', short: 'Ошибки' },
  { id: 'achievements', label: 'Достижения', short: 'Награды' },
];

export default function HskAcademyPreparation() {
  const [data, setData] = useState(null);
  const [words, setWords] = useState([]);
  const [review, setReview] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('history');

  const reload = async () => {
    const [prep, dict, rev, fav] = await Promise.all([
      api.examAcademy.me.preparation(),
      api.examAcademy.me.dictionary(),
      api.examAcademy.me.review(),
      api.examAcademy.me.favorites(),
    ]);
    setData(prep);
    setWords(Array.isArray(dict) ? dict : []);
    setReview(Array.isArray(rev) ? rev : []);
    setFavorites(Array.isArray(fav) ? fav : []);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (err) {
        if (!cancelled) setError(userFacingError(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const history = data?.history || [];
  const series = data?.stats_series || [];
  const achievements = data?.achievements || [];

  const removeWord = async (id) => {
    try {
      await api.examAcademy.me.deleteWord(id);
      setWords((rows) => rows.filter((w) => w.id !== id));
      toast({ title: 'Слово удалено' });
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const markLearned = async (id) => {
    try {
      await api.examAcademy.me.updateWord(id, { status: 'learned' });
      setWords((rows) => rows.map((w) => (w.id === id ? { ...w, status: 'learned' } : w)));
      toast({ title: 'Отмечено как выученное' });
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  const removeFavorite = async (id) => {
    try {
      await api.examAcademy.me.removeFavorite(id);
      setFavorites((rows) => rows.filter((f) => f.id !== id));
      toast({ title: 'Убрано из избранного' });
    } catch (err) {
      setError(userFacingError(err));
    }
  };

  return (
    <HskAcademyShell
      active="prep"
      title="Моя подготовка"
      description="История попыток, словарь, ошибки и динамика."
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div
        className="flex gap-1 overflow-x-auto border-b border-border pb-2 -mx-1 px-1"
        role="tablist"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={cn(
              'inline-flex shrink-0 items-center justify-center min-h-11 sm:min-h-10 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition-colors',
              tab === item.id
                ? 'bg-brand/10 text-brand font-medium'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
            onClick={() => setTab(item.id)}
          >
            <span className="sm:hidden">{item.short}</span>
            <span className="hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <Card className="border-border overflow-hidden">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Пока нет сессий. Начните с тренировки.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((row) => {
                const status = historyStatus(row);
                const percent = row.result_percent ?? row.resultPercent;
                return (
                <li
                  key={row.id}
                  className="px-3 sm:px-4 py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-sm truncate">
                      {row.title || MODE_LABEL[row.mode] || row.mode}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {MODE_LABEL[row.mode] || row.mode}
                      {row.level?.title ? ` · ${row.level.title}` : ''}
                      {' · '}
                      {STATUS_LABEL[status] || status}
                      {percent != null ? ` · ${Math.round(Number(percent))}%` : ''}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {status === 'completed' || status === 'expired' ? (
                      <Button asChild size="sm" variant="outline" className="min-h-10">
                        <Link to={`${createPageUrl('HskAcademyResult')}?sessionId=${row.id}`}>
                          Результат
                        </Link>
                      </Button>
                    ) : null}
                    {status === 'in_progress' ? (
                      <Button asChild size="sm" className="min-h-10">
                        <Link to={`${createPageUrl('HskAcademyTake')}?sessionId=${row.id}&from=prep`}>
                          Продолжить
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'dynamics' && (
        <Card className="p-4 border-border space-y-3">
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Недостаточно данных.</p>
          ) : (
            <ul className="space-y-2">
              {series.map((row) => {
                const pct = Math.min(100, Number(row.avgPercent) || 0);
                return (
                  <li key={row.id} className="grid grid-cols-[4.5rem_1fr_2.75rem] gap-2 items-center text-sm">
                    <span className="text-muted-foreground text-xs truncate">{row.day}</span>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <strong className="text-right tabular-nums text-xs">{pct}%</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'dictionary' && (
        <Card className="border-border overflow-hidden">
          {words.length === 0 ? (
            <p className="text-sm text-muted-foreground p-4">Словарь пуст.</p>
          ) : (
            <ul className="divide-y divide-border">
              {words.map((w) => (
                <li
                  key={w.id}
                  className="px-3 sm:px-4 py-3 flex flex-wrap justify-between gap-2"
                >
                  <div className="min-w-0">
                    <strong className="text-sm">{w.word}</strong>
                    {w.pinyin ? (
                      <span className="text-muted-foreground text-sm"> · {w.pinyin}</span>
                    ) : null}
                    {w.translation ? (
                      <div className="text-sm text-muted-foreground">{w.translation}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground mt-0.5">{w.status || 'saved'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2 shrink-0">
                    {w.status !== 'learned' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-10"
                        onClick={() => markLearned(w.id)}
                      >
                        Выучено
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10"
                      onClick={() => removeWord(w.id)}
                    >
                      Удалить
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'favorites' && (
        <Card className="p-4 border-border space-y-3">
          {favorites.length > 0 ? (
            <ul className="divide-y divide-border -mx-4">
              {favorites.map((f) => (
                <li
                  key={f.id}
                  className="px-4 py-2.5 flex flex-wrap justify-between gap-2 text-sm"
                >
                  <span className="text-muted-foreground truncate min-w-0">
                    {f.contentKind || f.content_kind} ·{' '}
                    {String(f.contentId || f.content_id).slice(0, 8)}…
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-10 shrink-0"
                    onClick={() => removeFavorite(f.id)}
                  >
                    Убрать
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Пока пусто.</p>
          )}
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <Link to={`${createPageUrl('HskAcademyPractice')}?mode=favorites`}>
              Тренировать избранное
            </Link>
          </Button>
        </Card>
      )}

      {tab === 'review' && (
        <Card className="p-4 border-border space-y-3">
          {review.length > 0 ? (
            <ul className="space-y-1.5 text-sm">
              {review.slice(0, 20).map((r) => (
                <li key={r.id} className="rounded-md bg-muted/40 px-3 py-2">
                  Ошибок: {r.wrongCount || r.wrong_count || 1}
                  {r.lastWrongAt || r.last_wrong_at
                    ? ` · ${new Date(r.lastWrongAt || r.last_wrong_at).toLocaleDateString()}`
                    : ''}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Ошибок нет.</p>
          )}
          <Button asChild className="min-h-11 w-full sm:w-auto">
            <Link to={`${createPageUrl('HskAcademyPractice')}?mode=error_review`}>
              Начать повторение
            </Link>
          </Button>
        </Card>
      )}

      {tab === 'achievements' && (
        <Card className="p-4 border-border space-y-2">
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет достижений.</p>
          ) : (
            <ul className="space-y-1.5">
              {achievements.map((row) => (
                <li key={row.id} className="rounded-md bg-muted/40 px-3 py-2 text-sm">
                  <strong>{row.achievement?.title || row.achievementId}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
    </HskAcademyShell>
  );
}
