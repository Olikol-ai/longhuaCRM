import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/design-system/primitives/Card';
import { iconSize } from '@/design-system/tokens/icon';
import { cn } from '@/lib/utils';

export function MaterialCard({ title, subtitle, meta, icon: Icon, actions, className, onClick }) {
  return (
    <Card
      className={cn('overflow-hidden', onClick && 'cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-start gap-3 space-y-0">
        {Icon ? (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
            <Icon className={iconSize.md} aria-hidden />
          </div>
        ) : null}
        <div className="min-w-0 space-y-1">
          <CardTitle className="text-base truncate">{title}</CardTitle>
          {subtitle ? <CardDescription className="line-clamp-2">{subtitle}</CardDescription> : null}
        </div>
      </CardHeader>
      {(meta || actions) && (
        <CardContent className="p-4 pt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground min-w-0 truncate">{meta}</div>
          {actions}
        </CardContent>
      )}
    </Card>
  );
}
