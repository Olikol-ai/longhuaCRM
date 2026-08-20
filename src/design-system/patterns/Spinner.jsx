import { cn } from '@/lib/utils';

export function Spinner({ className, size = 'md', label = 'Загрузка' }) {
  const sizeClass =
    size === 'sm' ? 'size-5 border-2' : size === 'lg' ? 'size-10 border-4' : 'size-8 border-4';

  return (
    <div
      role="status"
      aria-label={label}
      className={cn(
        sizeClass,
        'rounded-full border-muted border-t-brand animate-spin',
        className,
      )}
    />
  );
}
