import { useRef, useState } from 'react';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { api } from '@/api';
import { buildUserAvatarUrl } from '@/api/http';
import { useAuth } from '@/lib/AuthContext';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';

const ACCEPT = 'image/png,image/jpeg,image/webp';
const MAX_BYTES = 5 * 1024 * 1024;

function initialsFromUser(user) {
  const name = user?.full_name || user?.name || user?.email || 'U';
  return String(name).trim().charAt(0).toUpperCase() || 'U';
}

/**
 * Unified profile photo editor: upload / delete + live preview.
 * After changes, refreshes session so Layout/Profile/Settings update without reload.
 */
export default function AvatarEditor({
  user: userProp = null,
  sizeClass = 'h-16 w-16',
  roundedClass = 'rounded-2xl',
  showDelete = true,
  className = '',
}) {
  const { user: sessionUser, checkAppState } = useAuth();
  const user = userProp || sessionUser;
  const fileRef = useRef(null);
  const [busy, setBusy] = useState(false);

  if (!user?.id) return null;

  const hasAvatar = Boolean(user.has_avatar || user.avatar_updated_at);
  const src = hasAvatar
    ? buildUserAvatarUrl(user.id, {
        thumb: true,
        version: user.avatar_updated_at || 0,
      })
    : null;

  const validateFile = (file) => {
    if (!file) return 'Выберите файл';
    if (file.size > MAX_BYTES) return 'Размер файла не должен превышать 5 МБ';
    const type = String(file.type || '').toLowerCase();
    if (type && !['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
      return 'Допустимы только JPG, PNG или WebP';
    }
    return null;
  };

  const onPick = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const validationError = validateFile(file);
    if (validationError) {
      toast({ title: validationError, variant: 'destructive' });
      return;
    }
    setBusy(true);
    try {
      await api.users.avatar.upload({ file });
      await checkAppState?.({ force: true });
      toast({ title: 'Фотография обновлена' });
    } catch (err) {
      toast({
        title: 'Не удалось загрузить фотографию',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  const onRemove = async () => {
    if (!hasAvatar || busy) return;
    setBusy(true);
    try {
      await api.users.avatar.remove();
      await checkAppState?.({ force: true });
      toast({ title: 'Фотография удалена' });
    } catch (err) {
      toast({
        title: 'Не удалось удалить фотографию',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`flex items-center gap-4 ${className}`} data-testid="avatar-editor">
      <Avatar className={`${sizeClass} ${roundedClass} shrink-0`}>
        {src ? (
          <AvatarImage src={src} alt="" className="object-cover" />
        ) : null}
        <AvatarFallback className={`bg-brand-soft text-brand text-lg font-semibold ${roundedClass}`}>
          {initialsFromUser(user)}
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-2 min-w-0">
        <button
          type="button"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 text-sm font-medium text-brand hover:text-brand-active disabled:opacity-50"
          data-testid="avatar-change-button"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
          Изменить фотографию
        </button>
        {showDelete && hasAvatar ? (
          <button
            type="button"
            disabled={busy}
            onClick={onRemove}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
            data-testid="avatar-remove-button"
          >
            <Trash2 className="h-4 w-4" />
            Удалить фотографию
          </button>
        ) : null}
        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          className="hidden"
          data-testid="avatar-file-input"
          onChange={onPick}
        />
      </div>
    </div>
  );
}
