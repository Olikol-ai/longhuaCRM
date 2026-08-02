import { Link } from 'react-router-dom';
import { Award } from 'lucide-react';
import { createPageUrl } from '@/utils';
import { useAuth } from '@/lib/AuthContext';
import { cn } from '@/lib/utils';

export default function HskAcademyShell({ active, children }) {
  const { user } = useAuth();
  const canBank = ['admin', 'teacher', 'tutor'].includes(user?.role);
  const tabs = [
    { id: 'hub', label: 'Обзор', page: 'HskAcademy' },
    { id: 'practice', label: 'Тренировка', page: 'HskAcademyPractice' },
    { id: 'mock', label: 'Пробный экзамен', page: 'HskAcademyMock' },
    { id: 'prep', label: 'Моя подготовка', page: 'HskAcademyPreparation' },
    ...(canBank ? [{ id: 'bank', label: 'Контент', page: 'ExamContent' }] : []),
  ];

  return (
    <div className="space-y-6 w-full min-w-0">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-lg bg-brand text-primary-foreground grid place-items-center">
            <Award className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Longhua CRM</p>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">HSK Academy</h1>
          </div>
        </div>
        <nav
          className="flex flex-wrap gap-2 max-w-full overflow-x-auto"
          aria-label="HSK Academy"
        >
          {tabs.map((tab) => (
            <Link
              key={tab.id}
              to={createPageUrl(tab.page)}
              className={cn(
                'rounded-md px-3 py-2 text-sm border transition-colors min-h-11 inline-flex items-center',
                active === tab.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border text-foreground',
              )}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
