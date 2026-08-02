import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';
import AcademyBackButton from '@/components/hsk-academy/AcademyBackButton';

const NAV = [
  { id: 'hub', label: 'Обзор', page: 'ExamContent' },
  { id: 'bank', label: 'Банк вопросов HSK', page: 'ExamContentBank' },
  { id: 'media', label: 'Медиатека', page: 'ExamContentMedia' },
  { id: 'exams', label: 'Тесты', page: 'ExamContentExams' },
  { id: 'ops', label: 'Дополнительно', page: 'ExamContentOps' },
];

const PAGE_BY_ACTIVE = {
  hub: 'ExamContent',
  bank: 'ExamContentBank',
  media: 'ExamContentMedia',
  exams: 'ExamContentExams',
  ops: 'ExamContentOps',
};

export default function ExamContentShell({ active, children, title, description }) {
  const backPage = PAGE_BY_ACTIVE[active] || 'ExamContent';

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-5 min-w-0 overflow-x-hidden">
      <div className="min-w-0 space-y-2">
        <AcademyBackButton page={backPage} />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          {title || 'Студия HSK'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {description ||
            'Задания и тесты только для HSK Academy. Не смешиваются с «Мои вопросы» и домашними заданиями.'}
        </p>
      </div>

      <nav
        className="flex gap-1 sm:gap-2 overflow-x-auto border-b border-border pb-2 -mx-1 px-1"
        aria-label="Студия HSK"
      >
        {NAV.map((item) => {
          const isActive = active === item.id;
          return (
            <Link
              key={item.id}
              to={createPageUrl(item.page)}
              className={cn(
                'inline-flex shrink-0 items-center justify-center min-h-11 sm:min-h-10 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition-colors',
                isActive
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="space-y-4 sm:space-y-5 min-w-0">{children}</div>
    </div>
  );
}
