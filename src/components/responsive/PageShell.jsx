import { cn } from '@/lib/utils';

/**
 * Unified page shell: consistent padding, max width, and no horizontal page scroll.
 *
 * Breakpoints (tailwind):
 * - mobile &lt;640
 * - tablet 640–1023 (sm/md)
 * - desktop ≥1024 (lg)
 */
export default function PageShell({
  children,
  className = '',
  /** @type {'sm'|'md'|'lg'|'xl'|'full'|false} */
  maxWidth = 'xl',
  dense = false,
  ...rest
}) {
  const max =
    maxWidth === false || maxWidth === 'full'
      ? ''
      : maxWidth === 'sm'
        ? 'max-w-3xl'
        : maxWidth === 'md'
          ? 'max-w-4xl'
          : maxWidth === 'lg'
            ? 'max-w-5xl'
            : 'max-w-6xl';

  return (
    <div
      className={cn(
        'page-pad w-full min-w-0 mx-auto space-y-4 sm:space-y-5 lg:space-y-6',
        dense && 'space-y-3 sm:space-y-4',
        max,
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  );
}
