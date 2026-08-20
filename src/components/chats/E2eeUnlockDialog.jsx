import { useState } from 'react';
import { Lock } from 'lucide-react';
import {
  Button,
  PasswordInput,
  ResponsiveDialog,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/design-system';
import { iconSize } from '@/design-system/tokens/icon';
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
          <Lock className={iconSize.sm} />
          {title || (missing ? 'Настроить сквозное шифрование' : 'Разблокировать личные чаты')}
        </ResponsiveDialogTitle>
        <ResponsiveDialogDescription>
          {missing
            ? 'Для личных сообщений будут созданы ключи шифрования. Пароль используется только локально для защиты ключа.'
            : 'Введите пароль аккаунта, чтобы расшифровать личные сообщения на этом устройстве.'}
        </ResponsiveDialogDescription>
      </ResponsiveDialogHeader>
      <form onSubmit={submit} className="mt-2 space-y-3">
        <PasswordInput
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="text-base"
        />
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <ResponsiveDialogFooter>
          <Button type="button" intent="outline" onClick={() => onOpenChange?.(false)}>
            Отмена
          </Button>
          <Button type="submit" disabled={busy || !password} loading={busy}>
            {missing ? 'Создать ключи' : 'Разблокировать'}
          </Button>
        </ResponsiveDialogFooter>
      </form>
    </ResponsiveDialog>
  );
}
