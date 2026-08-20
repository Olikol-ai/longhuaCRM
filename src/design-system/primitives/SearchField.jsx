import * as React from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/design-system/primitives/Input';
import { iconSize } from '@/design-system/tokens/icon';
import { cn } from '@/lib/utils';

const SearchField = React.forwardRef(function DsSearchField(
  { className, inputClassName, ...props },
  ref,
) {
  return (
    <div className={cn('relative min-w-0', className)}>
      <Search
        className={cn(
          iconSize.md,
          'absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none',
        )}
        aria-hidden
      />
      <Input
        ref={ref}
        type="search"
        className={cn('pl-10', inputClassName)}
        {...props}
      />
    </div>
  );
});

SearchField.displayName = 'DsSearchField';

export { SearchField };
