import * as React from 'react';
import { Button } from '@/design-system/primitives/Button';
import { cn } from '@/lib/utils';

/**
 * Square icon-only control. Pass a single Lucide icon as children.
 */
const IconButton = React.forwardRef(function DsIconButton(
  { intent = 'ghost', className, label, children, ...props },
  ref,
) {
  return (
    <Button
      ref={ref}
      intent={intent}
      size="icon"
      aria-label={label}
      className={cn(className)}
      {...props}
    >
      {children}
    </Button>
  );
});

IconButton.displayName = 'DsIconButton';

export { IconButton };
