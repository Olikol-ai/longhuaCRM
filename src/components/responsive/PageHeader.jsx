import { cn } from '@/lib/utils';

/**
 * Page title + actions: stacked on mobile, row on desktop.
 */
export default function PageHeader({
  title,
  description = null,
  actions = null,
  className = '',
  titleClassName = '',
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between min-w-0',
        className,
      )}
    >
      <div className="min-w-0 space-y-1">
        {typeof title === 'string' ? (
          <h1 className={cn('text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate', titleClassName)}>
            {title}
          </h1>
        ) : (
          title
        )}
        {description ? (
          <p className="text-sm text-muted-foreground max-w-2xl">{description}</p>
        ) : null}
      </div>
      {actions ? (
        <div className="flex flex-wrap items-center gap-2 shrink-0 w-full sm:w-auto [&_button]:min-h-touch">
          {actions}
        </div>
      ) : null}
    </div>
  );
}
