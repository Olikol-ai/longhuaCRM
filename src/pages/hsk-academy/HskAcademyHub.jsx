import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BookOpen,
  ChevronRight,
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
import { canManageHskAcademyContent } from '@/lib/hskAcademyAccess';
import { userFacingError } from '@/lib/userFacingError';
import HskAcademyShell from '@/components/hsk-academy/HskAcademyShell';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const MODE_LABEL = {
  practice: 'Тренировка',
  mock_exam: 'Пробный экзамен',
  random_exam: 'Случайный экзамен',
  error_review: 'Разбор ошибок',
  favorites: 'Избранное',
};

const PRIMARY = [
  {
    to: 'HskAcademyPractice',
    icon: Sparkles,
    title: 'Тренировка',
    text: 'Раздел и уровень на выбор. Можно проходить сколько угодно.',
  },
  {
    to: 'HskAcademyMock',
    icon: ClipboardCheck,
    title: 'Пробный экзамен',
    text: 'Таймер и структура как на реальном экзамене.',
  },
  {
    to: 'HskAcademyPreparation',
    icon: BookOpen,
    title: 'Моя подготовка',
    text: 'История, словарь, ошибки и динамика.',
  },
];

export default function HskAcademyHub() {
  const { user } = useAuth();
  const canBank = canManageHskAcademyContent(user?.role);
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
  const inProgress = history.filter(
    (s) => (s.display_status || s.displayStatus || s.status) === 'in_progress',
  );

  const stats = [
    ['Тренировки', summary.practice_count ?? 0],
    ['Экзамены', summary.mock_count ?? 0],
    ['Средний %', summary.average_percent ?? 0],
    ['Лучший %', summary.best_percent ?? 0],
  ];

  const quickLinks = [
    {
      to: `${createPageUrl('HskAcademyPractice')}?mode=error_review`,
      icon: RefreshCw,
      label: `Повторить ошибки${summary.review_count != null ? ` (${summary.review_count})` : ''}`,
    },
    {
      to: `${createPageUrl('HskAcademyPractice')}?mode=favorites`,
      icon: Star,
      label: `Избранное${summary.favorites_count != null ? ` (${summary.favorites_count})` : ''}`,
    },
    {
      to: `${createPageUrl('HskAcademyMock')}?mode=random_exam`,
      icon: Trophy,
      label: 'Случайный экзамен',
    },
    ...(canBank
      ? [{ to: createPageUrl('ExamContent'), icon: Database, label: 'Студия HSK' }]
      : []),
  ];

  return (
    <HskAcademyShell active="hub">
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      {inProgress.length > 0 ? (
        <Card className="p-3 sm:p-4 border-border border-brand/30 bg-brand/5 dark:bg-brand/10">
          <div className="flex items-center justify-between gap-2 mb-2">
            <h2 className="text-sm font-medium text-foreground">Продолжить</h2>
          </div>
          <ul className="space-y-2">
            {inProgress.slice(0, 2).map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between gap-3 rounded-lg bg-background/80 border border-border px-3 py-2.5 min-h-11"
              >
                <span className="text-sm truncate min-w-0">
                  {row.title || MODE_LABEL[row.mode] || 'Сессия'}
                </span>
                <Button asChild size="sm" className="shrink-0 min-h-10">
                  <Link to={`${createPageUrl('HskAcademyTake')}?sessionId=${row.id}&from=prep`}>
                    Открыть
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {PRIMARY.map((m) => {
          const Icon = m.icon;
          return (
            <Link key={m.to} to={createPageUrl(m.to)} className="block group min-w-0">
              <Card className="h-full p-4 border-border transition-colors group-hover:bg-muted/40 group-hover:border-brand/30">
                <div className="flex items-start justify-between gap-2">
                  <Icon className="h-5 w-5 text-brand shrink-0" />
                  <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <h2 className="font-medium text-foreground mt-3">{m.title}</h2>
                <p className="text-sm text-muted-foreground mt-1 leading-snug">{m.text}</p>
              </Card>
            </Link>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {quickLinks.map((link) => {
          const Icon = link.icon;
          return (
            <Button
              key={link.label}
              asChild
              variant="outline"
              size="sm"
              className="min-h-11 sm:min-h-9 gap-1.5"
            >
              <Link to={link.to}>
                <Icon className="h-3.5 w-3.5" />
                {link.label}
              </Link>
            </Button>
          );
        })}
      </div>

      <div className="rounded-lg border border-border bg-card divide-y sm:divide-y-0 sm:grid sm:grid-cols-4 sm:divide-x divide-border overflow-hidden">
        {loading ? (
          <p className="text-sm text-muted-foreground p-4 col-span-full">Загрузка…</p>
        ) : (
          stats.map(([label, value]) => (
            <div key={label} className="px-4 py-3 min-w-0">
              <p className="text-xs text-muted-foreground truncate">{label}</p>
              <p className="text-xl font-semibold text-foreground mt-0.5 tabular-nums">{value}</p>
            </div>
          ))
        )}
      </div>
    </HskAcademyShell>
  );
}
