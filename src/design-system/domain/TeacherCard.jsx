import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/design-system/primitives/Card';
import { Avatar, AvatarFallback, AvatarImage } from '@/design-system/primitives/Avatar';
import { cn } from '@/lib/utils';

export function TeacherCard({
  name,
  subtitle,
  avatarUrl,
  initials,
  meta,
  actions,
  className,
  onClick,
}) {
  return (
    <Card
      className={cn('overflow-hidden', onClick && 'cursor-pointer hover:shadow-md transition-shadow', className)}
      onClick={onClick}
    >
      <CardHeader className="p-4 pb-2 flex flex-row items-center gap-3 space-y-0">
        <Avatar className="size-10">
          {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
          <AvatarFallback>{initials || '?'}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 space-y-1">
          <CardTitle className="text-base truncate">{name}</CardTitle>
          {subtitle ? <CardDescription className="truncate">{subtitle}</CardDescription> : null}
        </div>
      </CardHeader>
      {(meta || actions) && (
        <CardContent className="p-4 pt-2 flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground min-w-0">{meta}</div>
          {actions}
        </CardContent>
      )}
    </Card>
  );
}
