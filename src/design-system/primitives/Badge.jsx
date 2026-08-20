import * as React from 'react';
import { Badge as UiBadge, badgeVariants } from '@/components/ui/badge';

/**
 * @param {'default'|'secondary'|'destructive'|'outline'|'gold'|'success'|'warning'|'info'|'neutral'} [tone]
 */
const toneToVariant = {
  default: 'default',
  secondary: 'secondary',
  destructive: 'destructive',
  danger: 'destructive',
  outline: 'outline',
  gold: 'gold',
  success: 'success',
  warning: 'warning',
  info: 'secondary',
  neutral: 'outline',
};

function Badge({ tone = 'default', variant, ...props }) {
  const resolved = variant ?? toneToVariant[tone] ?? 'default';
  return <UiBadge variant={resolved} {...props} />;
}

export { Badge, badgeVariants };
