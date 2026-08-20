import { useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { BookOpen } from 'lucide-react';
import { Button, Input } from '@/design-system';
import { userFacingError } from '@/lib/userFacingError';

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
      setError(userFacingError(err, 'Не удалось отправить ссылку. Попробуйте позже.'));
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
          <p className="text-muted-foreground">Восстановление пароля</p>
        </div>

        <div className="bg-card rounded-2xl border border-border shadow-xl p-6 space-y-5">
          <h2 className="text-xl font-semibold text-foreground text-center">Восстановление пароля</h2>

          {submitted ? (
            <div className="space-y-4">
              <p
                className="text-sm text-foreground bg-muted p-4 rounded-lg leading-relaxed"
                data-testid="forgot-password-success"
              >
                {SUCCESS_MESSAGE}
              </p>
              <Link
                to="/login"
                className="block text-center text-sm font-medium text-brand hover:underline"
              >
                Вернуться ко входу
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-foreground mb-1" htmlFor="forgot-email">
                  Эл. почта
                </label>
                <Input
                  id="forgot-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="ivan@example.com"
                  required
                  autoComplete="email"
                  data-testid="forgot-password-email"
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
                data-testid="forgot-password-submit"
              >
                Отправить ссылку
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
