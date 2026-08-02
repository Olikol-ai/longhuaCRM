import { Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { parentHref, parentOf } from '@/lib/hskAcademyNav';
import { cn } from '@/lib/utils';

/**
 * Hierarchical Back inside HSK Academy / Exam Content.
 */
export default function AcademyBackButton({ page, className, label }) {
  const [params] = useSearchParams();
  const parent = parentOf(page, params);
  const href = parentHref(page, params);
  if (!parent || !href) return null;

  return (
    <Link
      to={href}
      className={cn(
        'inline-flex items-center gap-1.5 min-h-10 text-sm text-muted-foreground hover:text-foreground transition-colors',
        className,
      )}
    >
      <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
      {label || `Назад · ${parent.label}`}
    </Link>
  );
}
