import { useState } from 'react';
import { Loader2, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/responsive/ResponsiveDialog';
import { useE2ee } from '@/lib/e2ee/E2eeContext';

/**
 * Unlock / create E2EE identity with account password.
 */
export default function E2eeUnlockDialog({ open, onOpenChange, title }) {
  const { unlockWithPassword, missing, busy, error } = useE2ee();
  const [password, setPassword] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    const ok = await unlockWithPassword(password);
    if (ok) {
      setPassword('');
      onOpenChange?.(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} fullscreenOnMobile={false}>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle className="flex items-center gap-2">
          <Lock className="h-4 w-4" />
          {title || (missing ? 'Настроить сквозное шифрование' : 'Разблокировать личные чаты')}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {missing
            ? 'Для личных сообщений будут созданы ключи шифрования. Пароль используется только локально для защиты ключа.'
            : 'Введите пароль аккаунта, чтобы расшифровать личные сообщения на этом устройстве.'}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <form onSubmit={submit} className="space-y-3 mt-2">
        <Input
          type="password"
          autoComplete="current-password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-base"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <ResponsiveDialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange?.(false)}>
            Отмена
          </Button>
          <Button type="submit" disabled={busy || !password}>
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Подождите…
              </>
            ) : missing ? (
              'Создать ключи'
            ) : (
              'Разблокировать'
            )}
          </Button>
        </ResponsiveDialogFooter>
      </form>
    </ResponsiveDialog>
  );
}
