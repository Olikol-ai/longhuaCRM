import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { BookOpen } from 'lucide-react';
import { Button, PasswordInput } from '@/design-system';
import { REGISTRATION_PASSWORD_HINT } from '@/lib/passwordPolicy';
import { userFacingError } from '@/lib/userFacingError';

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = useMemo(() => searchParams.get('token')?.trim() || '', [searchParams]);
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!token) {
      setError('Ссылка для сброса пароля недействительна или устарела.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }

    setLoading(true);
    try {
      const result = await api.auth.resetPassword(token, password, confirmPassword);
      setSuccess(result?.message || 'Пароль успешно изменён. Теперь вы можете войти с новым паролем.');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setError(userFacingError(err, 'Не удалось изменить пароль. Запросите новую ссылку.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background page-pad safe-pb">
      <div className="w-full max-w-md min-w-0">
        <div className="text-center mb-6 sm:mb-8">
          <div className="flex items-center justify-center gap-2 mb-3 min-w-0">
            <BookOpen className="h-9 w-9 sm:h-10 sm:w-10 text-brand shrink-0" />
            <h1 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight truncate">Longhua Academy</h1>
          </div>
          <p className="text-muted-foreground">Новый пароль</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-xl p-6 space-y-5">
          <h2 className="text-xl font-semibold text-foreground text-center">Задать новый пароль</h2>

          {!token ? (
            <div className="space-y-4" data-testid="reset-password-missing-token">
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">
                Ссылка для сброса пароля недействительна или устарела. Запросите новую на странице
                восстановления пароля.
              </p>
              <Link
                to="/forgot-password"
                className="block text-center text-sm font-medium text-brand hover:underline"
              >
                Восстановить пароль
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-4" data-testid="reset-password-success">
              <p className="text-sm text-foreground bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg leading-relaxed">
                {success}
              </p>
              <Link
                to="/login"
                className="block text-center text-sm font-medium text-brand hover:underline"
              >
                Перейти ко входу
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-password-form">
              <input type="hidden" name="token" value={token} data-testid="reset-password-token" />

              <div>
                <label className="block text-sm font-medium text-foreground mb-1" htmlFor="reset-password">
                  Новый пароль
                </label>
                <PasswordInput
                  id="reset-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  data-testid="reset-password-password"
                />
                <p className="mt-1 text-xs text-muted-foreground">{REGISTRATION_PASSWORD_HINT}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-foreground mb-1" htmlFor="reset-password-confirm">
                  Подтвердите пароль
                </label>
                <PasswordInput
                  id="reset-password-confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  data-testid="reset-password-confirm"
                />
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg" role="alert">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                intent="primary"
                loading={loading}
                className="w-full"
                data-testid="reset-password-submit"
              >
                Сохранить пароль
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-brand hover:underline"
                >
                  Вернуться ко входу
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
