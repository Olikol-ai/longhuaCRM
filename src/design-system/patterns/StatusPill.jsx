import { cn } from '@/lib/utils';
import { Badge } from '@/design-system/primitives/Badge';

const STATUS_TONE = {
  online: 'success',
  offline: 'neutral',
  busy: 'warning',
  lesson: 'info',
  payment: 'gold',
  homework: 'secondary',
  success: 'success',
  warning: 'warning',
  danger: 'danger',
  info: 'info',
  neutral: 'neutral',
};

/**
 * Unified status chip for presence and domain states.
 * @param {'online'|'offline'|'busy'|'lesson'|'payment'|'homework'|'success'|'warning'|'danger'|'info'|'neutral'} status
 */
export function StatusPill({ status = 'neutral', children, className, ...props }) {
  const tone = STATUS_TONE[status] || 'neutral';
  return (
    <Badge tone={tone} className={cn('font-medium', className)} {...props}>
      {children}
    </Badge>
  );
}
