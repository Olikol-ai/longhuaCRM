import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardCheck,
  Database,
  RefreshCw,
  Sparkles,
  Star,
  Trophy,
} from 'lucide-react';
import { api } from '@/api';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const MODES = [
  {
    to: 'HskAcademyPractice',
    icon: Sparkles,
    title: 'Тренировка',
    text: 'Выберите версию, уровень и раздел. Можно проходить бесконечно.',
  },
  {
    to: 'HskAcademyMock',
    icon: ClipboardCheck,
    title: 'Пробный экзамен',
    text: 'Таймер, структура частей и последовательность как на экзамене.',
  },
  {
    to: 'HskAcademyPreparation',
    icon: BookOpen,
    title: 'Моя подготовка',
    text: 'История, словарь, ошибки, избранное и динамика.',
  },
];

export default function HskAcademyHub() {
  const { user } = useAuth();
  const canBank = ['admin', 'teacher', 'tutor'].includes(user?.role);
  const [prep, setPrep] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.examAcademy.me.preparation();
        if (!cancelled) setPrep(data);
      } catch (err) {
        if (!cancelled) setError(userFacingError(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const summary = prep?.summary || {};
  const history = prep?.history || [];
  const inProgress = history.filter((s) => s.status === 'in_progress');

  const extraModes = [
    {
      to: `${createPageUrl('HskAcademyPractice')}?mode=error_review`,
      icon: RefreshCw,
      title: 'Нужно повторить',
      text: `Автоматическая тренировка по ошибкам${summary.review_count != null ? ` (${summary.review_count})` : ''}.`,
      absolute: true,
    },
    {
      to: `${createPageUrl('HskAcademyPractice')}?mode=favorites`,
      icon: Star,
      title: 'Избранное',
      text: `Сохранённые задания${summary.favorites_count != null ? ` (${summary.favorites_count})` : ''}.`,
      absolute: true,
    },
    {
      to: `${createPageUrl('HskAcademyMock')}?mode=random_exam`,
      icon: Trophy,
      title: 'Случайный экзамен',
      text: 'Каждый запуск — новый вариант из банка.',
      absolute: true,
    },
  ];

  const stats = [
    ['Тренировки', summary.practice_count ?? 0],
    ['Экзамены', summary.mock_count ?? 0],
    ['Средний %', summary.average_percent ?? 0],
    ['Лучший %', summary.best_percent ?? 0],
    ['Повторить', summary.review_count ?? 0],
    ['Словарь', summary.dictionary_count ?? 0],
  ];

  return (
    <HskAcademyShell active="hub">
      <div>
        <p className="text-sm text-muted-foreground">Подготовка к международным экзаменам</p>
        <p className="text-muted-foreground mt-1 max-w-2xl">
          Тренируйтесь в формате, близком к реальному HSK — на оригинальных заданиях Longhua.
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {inProgress.length > 0 ? (
        <Card className="p-4 space-y-3 border-border">
          <h2 className="font-medium">Продолжить</h2>
          <ul className="space-y-2">
            {inProgress.slice(0, 3).map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-3 py-2"
              >
                <span className="text-sm">{row.title || row.mode}</span>
                <Button asChild size="sm" className="min-h-11">
                  <Link to={`${createPageUrl('HskAcademyTake')}?sessionId=${row.id}`}>
                    Открыть
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {MODES.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.to} to={createPageUrl(m.to)} className="block group">
              <Card className="h-full p-5 space-y-2 border-border transition-colors group-hover:bg-muted/40">
                <Icon className="h-5 w-5 text-brand" />
                <h2 className="font-medium text-foreground">{m.title}</h2>
                <p className="text-sm text-muted-foreground">{m.text}</p>
              </Card>
            </Link>
          );
        })}
        {extraModes.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.title} to={m.to} className="block group">
              <Card className="h-full p-5 space-y-2 border-border transition-colors group-hover:bg-muted/40">
                <Icon className="h-5 w-5 text-brand" />
                <h2 className="font-medium text-foreground">{m.title}</h2>
                <p className="text-sm text-muted-foreground">{m.text}</p>
              </Card>
            </Link>
          );
        })}
        {canBank ? (
          <Link to={createPageUrl('ExamContent')} className="block group">
            <Card className="h-full p-5 space-y-2 border-border transition-colors group-hover:bg-muted/40">
              <Database className="h-5 w-5 text-brand" />
              <h2 className="font-medium text-foreground">Exam Content</h2>
              <p className="text-sm text-muted-foreground">
                Студия контента: конструкторы, медиатека, редакции.
              </p>
            </Card>
          </Link>
        ) : null}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {loading ? (
          <p className="text-sm text-muted-foreground col-span-full">Загрузка статистики…</p>
        ) : (
          stats.map(([label, value]) => (
            <Card key={label} className="p-3 border-border">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-semibold mt-1">{value}</p>
            </Card>
          ))
        )}
      </div>
    </HskAcademyShell>
  );
}
