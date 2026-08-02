import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { canManageHskAcademyContent } from '@/lib/hskAcademyAccess';
import { cn } from '@/lib/utils';
import AcademyBackButton from '@/components/hsk-academy/AcademyBackButton';

const TABS = [
  { id: 'hub', label: 'Обзор', shortLabel: 'Обзор', page: 'HskAcademy' },
  { id: 'practice', label: 'Тренировка', shortLabel: 'Тренировка', page: 'HskAcademyPractice' },
  { id: 'mock', label: 'Пробный экзамен', shortLabel: 'Пробный', page: 'HskAcademyMock' },
  { id: 'prep', label: 'Моя подготовка', shortLabel: 'Подготовка', page: 'HskAcademyPreparation' },
];

const PAGE_BY_ACTIVE = {
  hub: 'HskAcademy',
  practice: 'HskAcademyPractice',
  mock: 'HskAcademyMock',
  prep: 'HskAcademyPreparation',
  bank: 'ExamContentBank',
};

export default function HskAcademyShell({ active, children, title, description }) {
  const { user } = useAuth();
  const canBank = canManageHskAcademyContent(user?.role);
  const tabs = canBank
    ? [
        ...TABS,
        {
          id: 'bank',
          label: 'Банк вопросов HSK',
          shortLabel: 'Банк HSK',
          page: 'ExamContentBank',
        },
      ]
    : TABS;

  const backPage = PAGE_BY_ACTIVE[active] || 'HskAcademy';

  return (
    <div className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-5 min-w-0 overflow-x-hidden">
      <div className="min-w-0 space-y-2">
        <AcademyBackButton page={backPage} />
        <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
          {title || 'HSK Academy'}
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          {description || 'Подготовка к HSK: тренировки, пробные экзамены и личный прогресс.'}
        </p>
      </div>

      <nav
        className="flex gap-1 sm:gap-2 overflow-x-auto border-b border-border pb-2 -mx-1 px-1"
        aria-label="HSK Academy"
      >
        {tabs.map((tab) => {
          const isActive = active === tab.id;
          return (
            <Link
              key={tab.id}
              to={createPageUrl(tab.page)}
              className={cn(
                'inline-flex shrink-0 items-center justify-center min-h-11 sm:min-h-10 rounded-lg px-2.5 sm:px-3 py-2 text-xs sm:text-sm transition-colors',
                isActive
                  ? 'bg-brand/10 text-brand font-medium'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground',
              )}
            >
              <span className="sm:hidden">{tab.shortLabel}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="space-y-4 sm:space-y-5 min-w-0">{children}</div>
    </div>
  );
}
