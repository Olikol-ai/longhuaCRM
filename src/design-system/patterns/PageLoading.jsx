import { Spinner } from '@/design-system/patterns/Spinner';
import { cn } from '@/lib/utils';

export function PageLoading({ label = 'Загрузка', className, fullScreen = false }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center bg-background',
        fullScreen ? 'fixed inset-0 z-50' : 'min-h-[12rem] w-full py-12',
        className,
      )}
    >
      <Spinner size="lg" label={label} />
    </div>
  );
}
