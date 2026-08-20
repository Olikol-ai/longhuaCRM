import { memo } from 'react';
import { buildUserAvatarUrl } from '@/api/http';
import { Avatar, AvatarFallback, AvatarImage } from '@/design-system';
import { displayUserName } from '@/lib/chat-normalize';
import { cn } from '@/lib/utils';

function initials(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!parts.length) return 'Л';
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return `${parts[0].slice(0, 1)}${parts[1].slice(0, 1)}`.toUpperCase();
}

function ChatAvatar({
  user,
  title,
  kind,
  online = false,
  size = 'md',
  className,
}) {
  const name = title || displayUserName(user);
  const sizeClass = size === 'lg' ? 'size-12' : size === 'sm' ? 'size-8' : 'size-11';
  const src = user?.id
    ? buildUserAvatarUrl(user.id, { thumb: true, version: user.avatarUpdatedAt || user.avatar_updated_at || 0 })
    : null;
  const tone =
    kind === 'direct'
      ? 'bg-brand-soft text-brand'
      : kind === 'subject'
        ? 'bg-brand-gold-soft text-[hsl(0_12%_10%)]'
        : 'bg-muted text-foreground';

  return (
    <span className={cn('relative shrink-0', className)}>
      <Avatar className={cn(sizeClass, 'ring-1 ring-black/5')}>
        {src ? <AvatarImage src={src} alt="" className="object-cover" /> : null}
        <AvatarFallback className={cn('text-xs font-semibold', tone)}>
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online ? (
        <span
          className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border-2 border-card bg-emerald-500 shadow-sm"
          aria-hidden
        />
      ) : null}
    </span>
  );
}

export default memo(ChatAvatar);
