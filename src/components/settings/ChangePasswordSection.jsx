import { useState } from 'react';
import { Lock } from 'lucide-react';
import { api } from '@/api';
import { Button, Label, PasswordInput } from '@/design-system';
import { toast } from '@/components/ui/use-toast';
import { useE2ee } from '@/lib/e2ee/E2eeContext';
import { REGISTRATION_PASSWORD_HINT } from '@/lib/passwordPolicy';
import { cn } from '@/lib/utils';

/**
 * Settings → Security: change own password (current password required).
 * Rewraps E2EE identity with the new password; does not rotate the keypair.
 */
export default function ChangePasswordSection({ className }) {
  const { rewrapWithNewPassword } = useE2ee();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [formError, setFormError] = useState('');

  const clientValidate = () => {
    if (!currentPassword) return 'Введите текущий пароль';
    if (!newPassword) return 'Введите новый пароль';
    if (newPassword !== confirmPassword) return 'Пароли не совпадают';
    if (newPassword.length < 6) return 'Пароль должен содержать не менее 6 символов.';
    if (!/[a-zA-Z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      return 'Пароль должен содержать хотя бы одну латинскую букву и одну цифру.';
    }
    return '';
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setSuccess(false);
    const localError = clientValidate();
    if (localError) {
      setFormError(localError);
      return;
    }
    setFormError('');
    setSaving(true);
    let rollback = null;
    try {
      const wrapResult = await rewrapWithNewPassword(currentPassword, newPassword);
      rollback = wrapResult?.rollback || null;
      const result = await api.auth.changePassword(
        currentPassword,
        newPassword,
        confirmPassword,
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setSuccess(true);
      toast({
        title: 'Пароль изменён',
        description:
          result?.message ||
          'Пароль успешно изменён. Личные чаты открываются новым паролем.',
      });
    } catch (err) {
      if (typeof rollback === 'function') {
        try {
          await rollback();
        } catch {
          // wrap restore is best-effort; login password was not changed
        }
      }
      const message =
        err?.data?.message ||
        err?.message ||
        'Не удалось изменить пароль';
      setFormError(Array.isArray(message) ? message.join(', ') : String(message));
      toast({
        title: 'Ошибка',
        description: Array.isArray(message) ? message.join(', ') : String(message),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className={cn(
        'bg-card rounded-2xl border border-border p-4 sm:p-6 space-y-4 mt-6 min-w-0 max-w-full overflow-hidden',
        className,
      )}
      data-testid="settings-change-password"
    >
      <div className="flex items-start gap-3 min-w-0">
        <div className="mt-0.5 inline-flex size-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <Lock className="size-5" aria-hidden />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Сменить пароль</h3>
          <p className="text-xs text-muted-foreground mt-0.5 break-words">
            {REGISTRATION_PASSWORD_HINT}. Потребуется текущий пароль. Ключ личных чатов
            сохраняется и заново защищается новым паролем.
          </p>
        </div>
      </div>

      <form className="space-y-3" onSubmit={onSubmit} noValidate>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="settings-current-password">Текущий пароль</Label>
          <PasswordInput
            id="settings-current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            autoComplete="current-password"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="settings-new-password">Новый пароль</Label>
          <PasswordInput
            id="settings-new-password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
            autoComplete="new-password"
            disabled={saving}
          />
        </div>
        <div className="space-y-1.5 min-w-0">
          <Label htmlFor="settings-confirm-password">Повторите новый пароль</Label>
          <PasswordInput
            id="settings-confirm-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            disabled={saving}
          />
        </div>

        {formError ? (
          <p className="text-sm text-destructive" role="alert" data-testid="settings-password-error">
            {formError}
          </p>
        ) : null}
        {success ? (
          <p className="text-sm text-brand" data-testid="settings-password-success">
            Пароль успешно изменён. Сессия остаётся активной. Личные чаты открываются новым паролем.
          </p>
        ) : null}

        <Button
          type="submit"
          intent="primary"
          className="w-full sm:w-auto min-h-11"
          disabled={saving}
          loading={saving}
          data-testid="settings-password-submit"
        >
          {saving ? 'Сохранение…' : 'Изменить пароль'}
        </Button>
      </form>
    </div>
  );
}
