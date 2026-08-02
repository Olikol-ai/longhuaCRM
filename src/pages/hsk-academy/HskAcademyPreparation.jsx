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
  draft: 'Черновик',
  ready: 'Готово',
  in_progress: 'В процессе',
  completed: 'Завершено',
  cancelled: 'Отменено',
};

const TABS = [
  ['history', 'История'],
  ['dynamics', 'Динамика'],
  ['dictionary', 'Словарь'],
  ['favorites', 'Избранное'],
  ['review', 'Ошибки'],
  ['achievements', 'Достижения'],
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
    <HskAcademyShell active="prep">
      <div>
        <h2 className="text-xl font-semibold">Моя подготовка</h2>
        <p className="text-sm text-muted-foreground mt-1">
          История, динамика, словарь, избранное, ошибки и достижения.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-wrap gap-2" role="tablist">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={cn(
              'rounded-md px-3 py-2 text-sm border min-h-11 transition-colors',
              tab === id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background border-border hover:bg-muted',
            )}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'history' && (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">История попыток</h3>
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет сессий. Начните с тренировки.</p>
          ) : (
            <ul className="divide-y divide-border">
              {history.map((row) => (
                <li
                  key={row.id}
                  className="py-3 flex flex-wrap items-center justify-between gap-2"
                >
                  <div>
                    <p className="font-medium text-sm">{row.title || MODE_LABEL[row.mode] || row.mode}</p>
                    <p className="text-xs text-muted-foreground">
                      {MODE_LABEL[row.mode] || row.mode}
                      {row.level?.title ? ` · ${row.level.title}` : ''}
                    </p>
                  </div>
                  <div className="text-sm flex flex-wrap gap-2 items-center">
                    <span>{STATUS_LABEL[row.status] || row.status}</span>
                    {row.status === 'completed' ? (
                      <Button asChild size="sm" variant="outline" className="min-h-11">
                        <Link to={`${createPageUrl('HskAcademyResult')}?sessionId=${row.id}`}>
                          Результат
                        </Link>
                      </Button>
                    ) : null}
                    {row.status === 'in_progress' ? (
                      <Button asChild size="sm" className="min-h-11">
                        <Link to={`${createPageUrl('HskAcademyTake')}?sessionId=${row.id}`}>
                          Продолжить
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {tab === 'dynamics' && (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Динамика</h3>
          {series.length === 0 ? (
            <p className="text-sm text-muted-foreground">Недостаточно данных.</p>
          ) : (
            <ul className="space-y-2">
              {series.map((row) => {
                const pct = Math.min(100, Number(row.avgPercent) || 0);
                return (
                  <li key={row.id} className="grid grid-cols-[5rem_1fr_3rem] gap-2 items-center text-sm">
                    <span className="text-muted-foreground text-xs">{row.day}</span>
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-brand" style={{ width: `${pct}%` }} />
                    </div>
                    <strong className="text-right">{pct}%</strong>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      )}

      {tab === 'dictionary' && (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Личный словарь</h3>
          {words.length === 0 ? (
            <p className="text-sm text-muted-foreground">Словарь пуст.</p>
          ) : (
            <ul className="space-y-2">
              {words.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-3 py-2"
                >
                  <div>
                    <strong>{w.word}</strong>
                    {w.pinyin ? (
                      <span className="text-muted-foreground text-sm"> · {w.pinyin}</span>
                    ) : null}
                    {w.translation ? (
                      <div className="text-sm text-muted-foreground">{w.translation}</div>
                    ) : null}
                    <div className="text-xs text-muted-foreground">{w.status || 'saved'}</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {w.status !== 'learned' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-11"
                        onClick={() => markLearned(w.id)}
                      >
                        Выучено
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-11"
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
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Избранное ({favorites.length})</h3>
          {favorites.length > 0 ? (
            <ul className="space-y-2">
              {favorites.map((f) => (
                <li
                  key={f.id}
                  className="flex flex-wrap justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm"
                >
                  <span className="text-muted-foreground">
                    {f.contentKind || f.content_kind} ·{' '}
                    {String(f.contentId || f.content_id).slice(0, 8)}…
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="min-h-11"
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
          <Button asChild className="min-h-11">
            <Link to={`${createPageUrl('HskAcademyPractice')}?mode=favorites`}>
              Тренировать избранное
            </Link>
          </Button>
        </Card>
      )}

      {tab === 'review' && (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Нужно повторить ({review.length})</h3>
          {review.length > 0 ? (
            <ul className="space-y-2 text-sm">
              {review.slice(0, 20).map((r) => (
                <li key={r.id} className="rounded-md border border-border px-3 py-2">
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
          <Button asChild className="min-h-11">
            <Link to={`${createPageUrl('HskAcademyPractice')}?mode=error_review`}>
              Начать повторение
            </Link>
          </Button>
        </Card>
      )}

      {tab === 'achievements' && (
        <Card className="p-4 space-y-3 border-border">
          <h3 className="font-medium">Достижения</h3>
          {achievements.length === 0 ? (
            <p className="text-sm text-muted-foreground">Пока нет достижений.</p>
          ) : (
            <ul className="space-y-2">
              {achievements.map((row) => (
                <li key={row.id} className="rounded-md border border-border px-3 py-2 text-sm">
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
