import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/design-system/primitives/Card';
import { StatusPill } from '@/design-system/patterns/StatusPill';
import { cn } from '@/lib/utils';

export function PaymentCard({ title, amount, subtitle, statusLabel, status = 'payment', className }) {
  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="p-4 pb-2 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <CardTitle className="text-base">{title}</CardTitle>
          {statusLabel ? <StatusPill status={status}>{statusLabel}</StatusPill> : null}
        </div>
        {subtitle ? <CardDescription>{subtitle}</CardDescription> : null}
      </CardHeader>
      <CardContent className="p-4 pt-2">
        <p className="text-2xl font-semibold tabular-nums text-foreground">{amount}</p>
      </CardContent>
    </Card>
  );
}
