import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { resolveRedirect } from '@/lib/routing';
import { BookOpen, Clock, KeyRound, Loader2, LogOut, Sparkles, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const DEFAULTS = {
  school_name: 'Longhua Chinese',
  title: 'Подтверждение email',
  subtitle: 'Платформа управления языковой школой',
  body_text:
    'Спасибо за регистрацию!\n\nПосле подтверждения кода администратор назначит вам роль — затем откроется доступ к платформе.',
  info_text: 'Если у вас есть вопросы — свяжитесь с администратором школы.',
};

export default function PendingApproval() {
  const { user, logout, establishSession } = useAuth();
  const navigate = useNavigate();
  const [settings] = useState(DEFAULTS);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState('');
  const [emailSent, setEmailSent] = useState(true);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [pendingEmail, setPendingEmail] = useState('');
  const [registrationVerified, setRegistrationVerified] = useState(false);
  const [verifiedRole, setVerifiedRole] = useState('');
  const verifyInFlightRef = useRef(false);

  useEffect(() => {
    const storedEmail = sessionStorage.getItem('longhua_pending_registration_email');
    if (storedEmail) {
      setPendingEmail(storedEmail);
    }
    const flag = sessionStorage.getItem('longhua_verification_email_sent');
    if (flag != null) {
      setEmailSent(flag === '1');
      sessionStorage.removeItem('longhua_verification_email_sent');
    }
    sessionStorage.removeItem('longhua_verification_code');
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return undefined;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const legacyNeedsVerification = user?.onboarding_state === 'needs_verification';
  const waitingForRole = user?.onboarding_state === 'awaiting_role';
  const isBlocked = user?.onboarding_state === 'blocked';
  const needsVerification =
    !registrationVerified && (legacyNeedsVerification || Boolean(pendingEmail));
  const displayEmail = pendingEmail || user?.email || '';

  const handleVerify = async (e) => {
    e.preventDefault();
    if (verifyInFlightRef.current || verifying) return;
    setError('');
    setVerifying(true);
    verifyInFlightRef.current = true;
    try {
      if (pendingEmail) {
        const result = await api.auth.verifyRegistration(pendingEmail, code.trim());
        sessionStorage.removeItem('longhua_pending_registration_email');
        sessionStorage.removeItem('longhua_verification_code');
        sessionStorage.removeItem('longhua_verification_email_sent');
        setPendingEmail('');
        setVerifiedRole(result?.role || '');
        setRegistrationVerified(true);
        return;
      }

      await api.auth.verifyCode(code.trim());
      sessionStorage.removeItem('longhua_verification_code');
      sessionStorage.removeItem('longhua_verification_email_sent');
      const sessionUser = await establishSession({ force: true });
      if (sessionUser?.onboarding_state === 'active') {
        navigate(resolveRedirect(sessionUser), { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Неверный код');
    } finally {
      setVerifying(false);
      verifyInFlightRef.current = false;
    }
  };

  const handleResend = async () => {
    setError('');
    try {
      const result = pendingEmail
        ? await api.auth.resendRegistrationCode(pendingEmail)
        : await api.auth.resendCode();
      if (result.email_sent) {
        setEmailSent(true);
        setResendCooldown(60);
        setError('');
      } else {
        setEmailSent(false);
        setError(result.message || 'Не удалось отправить письмо. Попробуйте позже или обратитесь к администратору.');
      }
    } catch (err) {
      if (err.retryAfter) {
        setResendCooldown(Number(err.retryAfter));
      }
      setError(err.message || 'Не удалось запросить новый код');
    }
  };

  const handleLogout = () => {
    sessionStorage.removeItem('longhua_pending_registration_email');
    logout();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-slate-50 flex items-center justify-center p-6">
      <div className="max-w-lg w-full text-center space-y-8">
        <div className="flex items-center justify-center gap-3">
          <div className="h-14 w-14 bg-indigo-600 rounded-2xl flex items-center justify-center shadow-lg shadow-indigo-200">
            <BookOpen className="h-7 w-7 text-white" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">{settings.school_name}</h1>
          <p className="text-slate-500 text-sm">{settings.subtitle}</p>
        </div>

        <div className="bg-white rounded-3xl shadow-xl shadow-slate-100 border border-slate-100 p-10 space-y-6 text-left">
          <div className="flex items-center justify-center">
            <div className="h-20 w-20 rounded-full bg-amber-50 flex items-center justify-center">
              {registrationVerified || waitingForRole ? (
                <CheckCircle2 className="h-10 w-10 text-emerald-500" />
              ) : (
                <Clock className="h-10 w-10 text-amber-500" />
              )}
            </div>
          </div>

          <div className="space-y-3 text-center">
            <h2 className="text-xl font-bold text-slate-800" data-testid="registration-result-title">
              {registrationVerified
                ? 'Регистрация успешно подтверждена'
                : user?.full_name
                  ? `Здравствуйте, ${user.full_name.split(' ')[0]}!`
                  : settings.title}
            </h2>

            {isBlocked && (
              <p className="text-red-600 font-medium">
                Аккаунт заблокирован. Обратитесь к администратору.
              </p>
            )}

            {registrationVerified && (
              <>
                <p className="text-emerald-600 font-medium">Email подтверждён ✓</p>
                {verifiedRole === 'student' ? (
                  <p className="text-slate-500 leading-relaxed">
                    Вам назначена роль ученика. Войдите с email и паролем, чтобы открыть личный кабинет.
                  </p>
                ) : (
                  <p className="text-slate-500 leading-relaxed">
                    Войдите в аккаунт. После входа доступ откроется, когда администратор назначит роль.
                  </p>
                )}
                <Button
                  asChild
                  className="w-full bg-indigo-600 hover:bg-indigo-700"
                  data-testid="registration-verified-login"
                >
                  <Link to="/login">Войти</Link>
                </Button>
              </>
            )}

            {needsVerification && (
              <>
                <p className="text-slate-500 leading-relaxed">
                  {emailSent
                    ? `Мы отправили код подтверждения на ${displayEmail || 'ваш email'}. Введите его ниже.`
                    : 'Не удалось отправить письмо с кодом. Запросите новый код или обратитесь к администратору.'}
                </p>
                {!emailSent && (
                  <p className="text-sm text-amber-700 bg-amber-50 rounded-xl px-4 py-3">
                    Email-сервис временно недоступен. Код не отображается в интерфейсе — попробуйте «Запросить новый код» позже.
                  </p>
                )}
                <form onSubmit={handleVerify} className="space-y-3 pt-2">
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                    <Input
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="000000"
                      className="pl-10 text-center font-mono tracking-widest"
                      maxLength={6}
                      required
                      data-testid="registration-verify-code"
                    />
                  </div>
                  {error && (
                    <p className="text-sm text-red-600 bg-red-50 p-2 rounded-lg" data-testid="registration-verify-error">
                      {error}
                    </p>
                  )}
                  <Button
                    type="submit"
                    disabled={verifying}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                    data-testid="registration-verify-submit"
                  >
                    {verifying ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Подтвердить код'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    disabled={resendCooldown > 0}
                    onClick={handleResend}
                  >
                    {resendCooldown > 0
                      ? `Повторная отправка через ${resendCooldown} сек.`
                      : 'Запросить новый код'}
                  </Button>
                </form>
              </>
            )}

            {!registrationVerified && waitingForRole && (
              <>
                <p className="text-emerald-600 font-medium">Аккаунт активирован ✓</p>
                <p className="text-slate-500 leading-relaxed">
                  Ожидайте подтверждения администратора. После назначения роли вы автоматически получите доступ.
                </p>
                {settings.body_text.split('\n').filter(Boolean).map((line, i) => (
                  <p key={i} className="text-slate-500 leading-relaxed text-sm">{line}</p>
                ))}
              </>
            )}
          </div>

          {!registrationVerified && (
            <div className="bg-indigo-50 rounded-2xl px-6 py-4 flex items-start gap-3">
              <Sparkles className="h-5 w-5 text-indigo-500 shrink-0 mt-0.5" />
              <p className="text-sm text-indigo-700">{settings.info_text}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col items-center gap-3">
          {(user || pendingEmail) && !registrationVerified && (
            <p className="text-xs text-slate-400">
              {pendingEmail && !user ? 'Регистрация для: ' : 'Вы вошли как: '}
              <span className="font-medium text-slate-600">{displayEmail}</span>
            </p>
          )}
          {!registrationVerified && (
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-slate-400 hover:text-slate-600 gap-2">
              <LogOut className="h-4 w-4" />
              {pendingEmail && !user ? 'Отменить регистрацию' : 'Выйти'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
