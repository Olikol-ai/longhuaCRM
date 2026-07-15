import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REGISTRATION_PASSWORD_HINT } from '@/lib/passwordPolicy';

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
      setError(err.message || 'Не удалось изменить пароль. Запросите новую ссылку.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-3">
            <BookOpen className="h-10 w-10 text-indigo-600" />
            <h1 className="text-3xl font-bold text-foreground tracking-tight">Longhua Chinese</h1>
          </div>
          <p className="text-muted-foreground">Новый пароль</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-5">
          <h2 className="text-xl font-semibold text-foreground text-center">Задать новый пароль</h2>

          {!token ? (
            <div className="space-y-4" data-testid="reset-password-missing-token">
              <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                Ссылка для сброса пароля недействительна или устарела. Запросите новую на странице
                восстановления пароля.
              </p>
              <Link
                to="/forgot-password"
                className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Восстановить пароль
              </Link>
            </div>
          ) : success ? (
            <div className="space-y-4" data-testid="reset-password-success">
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-emerald-50 dark:bg-emerald-950/30 p-4 rounded-lg leading-relaxed">
                {success}
              </p>
              <Link
                to="/login"
                className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Перейти ко входу
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4" data-testid="reset-password-form">
              <input type="hidden" name="token" value={token} data-testid="reset-password-token" />

              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Новый пароль
                </label>
                <Input
                  type="password"
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
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Подтвердите пароль
                </label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  required
                  autoComplete="new-password"
                  data-testid="reset-password-confirm"
                />
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
                  {error}
                </p>
              )}

              <Button
                type="submit"
                disabled={loading}
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                data-testid="reset-password-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Сохранение...
                  </>
                ) : (
                  'Сохранить пароль'
                )}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-indigo-600 hover:text-indigo-700 hover:underline"
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
