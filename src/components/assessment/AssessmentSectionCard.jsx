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
              ? 'bg-slate-100 dark:bg-slate-800 ring-slate-200 dark:ring-slate-700'
              : 'bg-brand-soft dark:bg-brand-soft/40 ring-brand/20 dark:ring-brand/30'
          }`}
        >
          {Icon ? (
            <Icon
              className={`h-5 w-5 ${
                soon
                  ? 'text-slate-400'
                  : 'text-brand dark:text-brand'
              }`}
            />
          ) : null}
        </div>
        {soon ? (
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wide font-semibold text-slate-400">
            <Lock className="h-3 w-3" />
            Скоро
          </span>
        ) : (
          <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-brand transition-colors" />
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 leading-snug">
          {description}
        </p>
      </div>
    </>
  );

  const className = `group rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/80 p-4 sm:p-5 text-left transition-shadow ${
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
