import { Link } from 'react-router-dom';
import {
  Archive,
  BookOpen,
  ClipboardList,
  FileQuestion,
  FileText,
  Layers,
  Loader2,
  Network,
  RefreshCw,
  Target,
  Trophy,
} from 'lucide-react';
import StatCard from '@/components/dashboard/StatCard';
import AssessmentSectionCard from '@/components/assessment/AssessmentSectionCard';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { createPageUrl } from '@/utils';
import { useAssessmentDashboard } from '@/hooks/useAssessmentDashboard';
import {
  RESULT_STATUS_LABEL,
  formatDateTime,
} from '@/lib/assessment-admin';

const SECTIONS = [
  {
    title: 'Банки вопросов',
    description: 'Контейнеры вопросов: создание, черновики, архив',
    icon: Archive,
    page: 'AssessmentBanks',
  },
  {
    title: 'Вопросы',
    description: 'Авторство вопросов всех типов и медиа',
    icon: FileQuestion,
    page: 'AssessmentQuestions',
  },
  {
    title: 'Шаблоны экзаменов',
    description: 'Структура и правила шаблонов',
    icon: FileText,
    page: 'AssessmentExamTemplates',
  },
  {
    title: 'Структура экзамена',
    description: 'Правила набора вопросов в экзамен',
    icon: Network,
    page: 'AssessmentBlueprints',
  },
  {
    title: 'Экзамены',
    description: 'Публикация и предпросмотр экзаменов',
    icon: BookOpen,
    page: 'AssessmentExams',
  },
  {
    title: 'Назначения экзаменов',
    description: 'Выдача экзаменов ученикам и группам',
    icon: Target,
    page: 'AssessmentAssignments',
  },
  {
    title: 'Результаты',
    description: 'Просмотр и проверка результатов',
    icon: Trophy,
    page: 'AssessmentResults',
  },
];

export default function AdminAssessment() {
  const { stats, recentResults, loading, error, reload } = useAssessmentDashboard();

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 mb-1">
            <ClipboardList className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wide">Экзамены</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Панель экзаменов
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Банки, вопросы, экзамены и результаты Longhua Chinese
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => reload()} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Обновить
        </Button>
      </div>

      {error && (
        <div
          className="rounded-2xl border border-rose-200 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 p-4 text-sm text-rose-800 dark:text-rose-200"
          role="alert"
        >
          <p className="font-medium">Не удалось загрузить сводку</p>
          <p className="mt-1 opacity-90">{error.message || 'Ошибка сети'}</p>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-7 w-7 animate-spin text-indigo-600" />
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
            <StatCard
              label="Вопросы"
              value={stats.questions}
              icon={FileQuestion}
              color="indigo"
            />
            <StatCard label="Экзамены" value={stats.exams} icon={BookOpen} color="sky" />
            <StatCard
              label="Активные назначения"
              value={stats.activeAssignments}
              icon={Target}
              color="emerald"
            />
          </div>

          <div>
            <div className="flex items-center gap-2 mb-3">
              <Layers className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                Разделы
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {SECTIONS.map((section) => (
                <AssessmentSectionCard key={section.title} {...section} />
              ))}
            </div>
          </div>

          <Card className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-2 mb-4">
              <h2 className="font-semibold text-slate-900 dark:text-white">
                Последние результаты
              </h2>
              <Link
                to={createPageUrl('AssessmentQuestions')}
                className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                К вопросам
              </Link>
            </div>

            {recentResults.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 dark:border-slate-600 p-8 text-center">
                <Trophy className="h-8 w-8 mx-auto text-slate-400 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  Пока нет результатов экзаменов
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm min-w-[520px]">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                      <th className="pb-2 pr-3 font-medium">Дата</th>
                      <th className="pb-2 pr-3 font-medium">Статус</th>
                      <th className="pb-2 pr-3 font-medium">Балл</th>
                      <th className="pb-2 font-medium">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentResults.map((row) => (
                      <tr
                        key={row.id}
                        className="border-b border-slate-100 dark:border-slate-800 last:border-0"
                      >
                        <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">
                          {formatDateTime(row.created_at || row.updated_at)}
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="inline-flex rounded-full px-2 py-0.5 text-xs bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200">
                            {RESULT_STATUS_LABEL[row.status] || row.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-slate-700 dark:text-slate-200">
                          {row.score ?? '—'}
                          {row.max_score != null ? ` / ${row.max_score}` : ''}
                        </td>
                        <td className="py-2.5 text-slate-700 dark:text-slate-200">
                          {row.percent != null ? `${Number(row.percent).toFixed(0)}%` : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
