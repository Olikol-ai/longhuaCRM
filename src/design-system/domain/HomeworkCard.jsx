import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/design-system/primitives/Card';
import { StatusPill } from '@/design-system/patterns/StatusPill';
import { cn } from '@/lib/utils';

export function HomeworkCard({
  title,
  subtitle,
  statusLabel,
  status = 'homework',
  dueLabel,
  actions,
  className,
  onClick,
}) {
  return (
    <Card
      className={cn('overflow-hidden', onClick && 'cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {statusLabel ? <StatusPill status={status}>{statusLabel}</StatusPill> : null}
        </div>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-4 pt-2 flex items-center justify-between gap-3">
        <div className="text-xs text-muted-foreground">{dueLabel}</div>
        {actions}
      </CardContent>
    </Card>
  );
}
