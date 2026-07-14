import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { BookOpen, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const SUCCESS_MESSAGE =
  'Если такой email зарегистрирован, на него отправлена ссылка для восстановления пароля.';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await api.auth.forgotPassword(email.trim());
      setSubmitted(true);
    } catch (err) {
      setError(err.message || 'Не удалось отправить ссылку. Попробуйте позже.');
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
          <p className="text-muted-foreground">Восстановление пароля</p>
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-xl p-6 space-y-5">
          <h2 className="text-xl font-semibold text-foreground text-center">Восстановление пароля</h2>

          {submitted ? (
            <div className="space-y-4">
              <p
                className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-800/60 p-4 rounded-lg leading-relaxed"
                data-testid="forgot-password-success"
              >
                {SUCCESS_MESSAGE}
              </p>
              <Link
                to="/login"
                className="block text-center text-sm font-medium text-indigo-600 hover:text-indigo-700 hover:underline"
              >
                Вернуться ко входу
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Email
                </label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                  required
                  autoComplete="email"
                  data-testid="forgot-password-email"
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
                data-testid="forgot-password-submit"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Отправка...
                  </>
                ) : (
                  'Отправить ссылку'
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
