import { Link } from 'react-router-dom';
import { ArrowRight, Lock } from 'lucide-react';
import { createPageUrl } from '@/utils';

/**
 * Section card on Admin Assessment dashboard.
 * When `soon` is true, card is non-interactive placeholder.
 */
export default function AssessmentSectionCard({
  title,
  description,
  icon: Icon,
  page,
  soon = false,
}) {
  const content = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div
          className={`h-10 w-10 rounded-xl flex items-center justify-center ring-1 ${
            soon
              ? 'bg-muted ring-slate-200 dark:ring-slate-700'
              : 'bg-brand-soft dark:bg-brand-soft/40 ring-brand/20 dark:ring-brand/30'
          }`}
        >
          {Icon ? (
            <Icon
              className={`h-5 w-5 ${
                soon
                  ? 'text-muted-foreground'
                  : 'text-brand dark:text-brand'
              }`}
            />
          ) : null}
        </div>
        {soon ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">
            <Lock className="h-3 w-3" />
            Скоро
          </span>
        ) : (
          <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-brand transition-colors" />
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-foreground">{title}</h3>
        <p className="text-sm text-muted-foreground leading-snug">
          {description}
        </p>
      </div>
    </>
  );

  const className = `group rounded-2xl border border-border bg-card/80 p-4 sm:p-5 text-left transition-shadow ${
    soon
      ? 'opacity-70 cursor-not-allowed'
      : 'hover:shadow-md hover:border-brand/40 dark:hover:border-brand/40'
  }`;

  if (soon || !page) {
    return (
      <div className={className} aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <Link to={createPageUrl(page)} className={className}>
      {content}
    </Link>
  );
}
