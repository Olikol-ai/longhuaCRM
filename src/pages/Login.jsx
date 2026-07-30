import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { resolveRedirect } from '@/lib/routing';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { REGISTRATION_PASSWORD_HINT } from '@/lib/passwordPolicy';
import { userFacingError } from '@/lib/userFacingError';

const INVITE_REF_KEY = 'longhua_teacher_invite_ref';

export default function Login() {
  const [searchParams] = useSearchParams();
  const inviteFromQuery = searchParams.get('ref')?.trim() || '';
  const [mode, setMode] = useState(inviteFromQuery ? 'register' : 'login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [wantsStudentRole, setWantsStudentRole] = useState(Boolean(inviteFromQuery));
  const [inviteToken, setInviteToken] = useState(inviteFromQuery);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { establishSession } = useAuth();

  useEffect(() => {
    if (inviteFromQuery) {
      sessionStorage.setItem(INVITE_REF_KEY, inviteFromQuery);
      setInviteToken(inviteFromQuery);
      setMode('register');
      setWantsStudentRole(true);
      return;
    }
    // No ?ref= in URL: never reuse a previous invite from sessionStorage.
    sessionStorage.removeItem(INVITE_REF_KEY);
    setInviteToken('');
  }, [inviteFromQuery]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'login') {
        await api.auth.login(email.trim(), password);
        const sessionUser = await establishSession({ force: true });
        if (!sessionUser) {
          setError('Не удалось установить сессию. Попробуйте снова.');
          return;
        }
        navigate(resolveRedirect(sessionUser), { replace: true });
      } else {
        // Only the current URL ref (or in-memory token set from it) may bind a teacher.
        const token = (inviteFromQuery || inviteToken || '').trim() || undefined;
        const result = await api.auth.register(
          email.trim(),
          password,
          firstName.trim(),
          lastName.trim(),
          {
            wantsStudentRole: Boolean(token) || wantsStudentRole,
            inviteToken: token,
          },
        );
        if (!result?.email_sent) {
          setError('Не удалось отправить код подтверждения');
          return;
        }
        sessionStorage.setItem('longhua_pending_registration_email', result.email || email.trim());
        sessionStorage.setItem('longhua_verification_email_sent', '1');
        sessionStorage.removeItem('longhua_verification_code');
        sessionStorage.removeItem(INVITE_REF_KEY);
        navigate('/auth/pending-approval', { replace: true });
      }
    } catch (err) {
      const message = userFacingError(
        err,
        mode === 'register' ? 'Не удалось отправить код подтверждения' : 'Не удалось войти. Проверьте email и пароль.',
      );
      setError(message);
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
          <p className="text-muted-foreground">Платформа управления языковой школой</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-5">
          <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setMode('login')}
              className={`flex-1 min-h-touch py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                mode === 'login' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Вход
            </button>
            <button
              type="button"
              onClick={() => setMode('register')}
              className={`flex-1 min-h-touch py-2.5 text-sm font-semibold rounded-lg transition-colors ${
                mode === 'register' ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Регистрация
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (
              <>
                {inviteToken && (
                  <p className="text-xs text-brand bg-brand-soft dark:bg-brand-soft/40 rounded-lg px-3 py-2">
                    Регистрация по приглашению преподавателя. После подтверждения email вы будете закреплены за ним.
                  </p>
                )}
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Фамилия</label>
                  <Input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Иванов" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Имя</label>
                  <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Иван" />
                </div>
                {!inviteToken && (
                  <label
                    className="flex items-start gap-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-brand-soft/70 dark:bg-brand-soft/30 px-3 py-3 cursor-pointer"
                    data-testid="register-wants-student-label"
                  >
                    <input
                      type="checkbox"
                      checked={wantsStudentRole}
                      onChange={(e) => setWantsStudentRole(e.target.checked)}
                      className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand focus:ring-brand"
                      data-testid="register-wants-student"
                    />
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 text-left">
                      Я являюсь учеником
                    </span>
                  </label>
                )}
              </>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Эл. почта</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="ivan@example.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Пароль</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
              />
              {mode === 'register' && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{REGISTRATION_PASSWORD_HINT}</p>
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive bg-destructive/10 p-3 rounded-lg">{error}</p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-primary hover:bg-primary/90"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Подождите...
                </>
              ) : mode === 'login' ? (
                'Войти'
              ) : (
                'Зарегистрироваться'
              )}
            </Button>

            {mode === 'login' && (
              <div className="text-center pt-1">
                <Link
                  to="/forgot-password"
                  className="text-sm text-brand hover:underline"
                  data-testid="forgot-password-link"
                >
                  Забыли пароль?
                </Link>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
