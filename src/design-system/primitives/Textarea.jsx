import * as React from 'react';
import { Textarea as UiTextarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

const Textarea = React.forwardRef(function DsTextarea({ className, ...props }, ref) {
  return <UiTextarea ref={ref} className={cn('min-h-[5.5rem]', className)} {...props} />;
});

Textarea.displayName = 'DsTextarea';

export { Textarea };
