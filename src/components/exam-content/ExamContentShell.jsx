import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { cn } from '@/lib/utils';

const NAV = [
  { id: 'hub', label: 'Обзор', page: 'ExamContent' },
  { id: 'bank', label: 'Банк', page: 'ExamContentBank' },
  { id: 'media', label: 'Медиа', page: 'ExamContentMedia' },
  { id: 'exams', label: 'Экзамены', page: 'ExamContentExams' },
  { id: 'ops', label: 'Импорт / экспорт', page: 'ExamContentOps' },
];

export default function ExamContentShell({ active, children }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">Exam Content Platform</p>
          <h1 className="text-2xl font-semibold tracking-tight">Студия контента</h1>
        </div>
        <nav className="flex flex-wrap gap-2">
          {NAV.map((item) => (
            <Link
              key={item.id}
              to={createPageUrl(item.page)}
              className={cn(
                'rounded-md px-3 py-1.5 text-sm border transition-colors',
                active === item.id
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background hover:bg-muted border-border',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </div>
  );
}
