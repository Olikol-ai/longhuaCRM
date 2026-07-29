import { Link } from 'react-router-dom';
import {
  BookOpen,
  ClipboardList,
  FileQuestion,
  NotebookPen,
} from 'lucide-react';
import AssessmentSectionCard from '@/components/assessment/AssessmentSectionCard';
import { createPageUrl } from '@/utils';

/**
 * Admin entry for the shared assessment workspace (same pages as teacher/tutor).
 * ACL differs only on the backend; this hub is navigation, not a separate module.
 */
const SECTIONS = [
  {
    title: 'Вопросы',
    description: 'Все тест-вопросы и контейнеры Listening / Reading всех авторов',
    icon: FileQuestion,
    page: 'AssessmentQuestions',
  },
  {
    title: 'Домашние задания',
    description: 'Все задания преподавателей и репетиторов, назначения и статусы',
    icon: NotebookPen,
    page: 'HomeworkList',
  },
  {
    title: 'Экзамены',
    description: 'Все экзамены: пулы генерации, публикация, назначения и результаты',
    icon: BookOpen,
    page: 'AssessmentExams',
  },
];

export default function AdminAssessment() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6">
      <div>
        <div className="flex items-center gap-2 text-brand dark:text-brand mb-1">
          <ClipboardList className="h-5 w-5" />
          <span className="text-xs font-semibold uppercase tracking-wide">
            Проверочные работы
          </span>
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Проверочные работы
        </h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Общий модуль с преподавателями и репетиторами. Администратор видит все материалы.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {SECTIONS.map((section) => (
          <AssessmentSectionCard
            key={section.page}
            title={section.title}
            description={section.description}
            icon={section.icon}
            page={section.page}
          />
        ))}
      </div>

      <div className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900/60 p-4 sm:p-5">
        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 mb-2">
          Дополнительно
        </p>
        <div className="flex flex-wrap gap-3 text-sm">
          <Link className="text-brand hover:underline" to={createPageUrl('AssessmentAssignments')}>
            Назначения экзаменов
          </Link>
          <Link className="text-brand hover:underline" to={createPageUrl('AssessmentResults')}>
            Результаты экзаменов
          </Link>
        </div>
      </div>
    </div>
  );
}
