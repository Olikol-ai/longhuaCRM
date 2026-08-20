import * as React from 'react';
import { Button as UiButton, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Design System Button.
 * Prefer intent props over inventing className variants.
 *
 * @param {'primary'|'secondary'|'ghost'|'danger'|'gold'|'outline'|'link'} [intent]
 * @param {'sm'|'md'|'lg'|'icon'} [size]
 */
const intentToVariant = {
  primary: 'default',
  secondary: 'secondary',
  ghost: 'ghost',
  danger: 'destructive',
  gold: 'gold',
  outline: 'outline',
  link: 'link',
};

const sizeToUi = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  icon: 'icon',
};

const Button = React.forwardRef(function DsButton(
  {
    intent = 'primary',
    size = 'md',
    variant,
    className,
    loading = false,
    disabled,
    children,
    ...props
  },
  ref,
) {
  const resolvedVariant = variant ?? intentToVariant[intent] ?? 'default';
  const resolvedSize = sizeToUi[size] ?? size;

  return (
    <UiButton
      ref={ref}
      variant={resolvedVariant}
      size={resolvedSize}
      disabled={disabled || loading}
      className={cn(loading && 'opacity-80', className)}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? (
        <span className="inline-flex items-center gap-2">
          <span
            className="size-4 shrink-0 rounded-full border-2 border-current border-t-transparent animate-spin"
            aria-hidden
          />
          {children}
        </span>
      ) : (
        children
      )}
    </UiButton>
  );
});

Button.displayName = 'DsButton';

export { Button, buttonVariants };
