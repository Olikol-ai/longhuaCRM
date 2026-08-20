import * as React from 'react';
import { Button } from '@/design-system/primitives/Button';
import { cn } from '@/lib/utils';

/**
 * Floating Action Button — thumb-zone primary action on mobile shells.
 */
const Fab = React.forwardRef(function DsFab(
  { intent = 'primary', className, children, label, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      intent={intent}
      size="lg"
      aria-label={label}
      className={cn(
        'fixed z-40 rounded-full shadow-lg min-h-14 min-w-14 h-14 w-14 p-0',
        'right-4 bottom-[max(1rem,env(safe-area-inset-bottom))]',
        'lg:right-6 lg:bottom-6',
        className,
      )}
      {...props}
    >
      {children}
    </Button>
  );
});

Fab.displayName = 'DsFab';

export { Fab };
