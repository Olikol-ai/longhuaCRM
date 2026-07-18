import { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api } from '@/api';
import { Check, Loader2, XCircle, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/formatters';
import { userFacingError } from '@/lib/userFacingError';

const STATUS_UI = {
  paid: {
    title: 'Оплата успешно завершена',
    icon: Check,
    iconClass: 'bg-emerald-100 text-emerald-600',
  },
  pending: {
    title: 'Оплата ещё проверяется',
    icon: Clock,
    iconClass: 'bg-amber-100 text-amber-600',
  },
  failed: {
    title: 'Оплата не прошла',
    icon: XCircle,
    iconClass: 'bg-red-100 text-red-600',
  },
  refunded: {
    title: 'Оплата возвращена',
    icon: XCircle,
    iconClass: 'bg-slate-100 text-slate-600',
  },
};

export default function PaymentReturn() {
  const [searchParams] = useSearchParams();
  const paymentIdFromQuery = searchParams.get('payment_id') || searchParams.get('paymentId');
  let paymentIdFromSession = '';
  try {
    paymentIdFromSession = sessionStorage.getItem('alfa_last_payment_id') || '';
  } catch {
    paymentIdFromSession = '';
  }
  const paymentId = paymentIdFromQuery || paymentIdFromSession;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!paymentId) {
      setError('Не указан идентификатор платежа.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let timer;

    const poll = async () => {
      try {
        const data = await api.alfabank.getPaymentStatus(paymentId);
        if (cancelled) return;
        setResult(data);
        setError('');
        setLoading(false);

        if (data.status === 'pending' && attempts < 8) {
          attempts += 1;
          timer = setTimeout(poll, 2500);
        }
      } catch (err) {
        if (cancelled) return;
        setError(
          userFacingError(
            err,
            'Не удалось проверить статус оплаты. Обновите страницу чуть позже.',
          ),
        );
        setLoading(false);
      }
    };

    poll();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [paymentId]);

  const ui = STATUS_UI[result?.status] || STATUS_UI.pending;
  const Icon = ui.icon;

  return (
    <div className="min-h-[60vh] flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 p-8 text-center space-y-5">
        {loading ? (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm text-slate-500">Проверяем статус оплаты…</p>
          </>
        ) : error ? (
          <>
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto">
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">Не удалось проверить оплату</h1>
            <p className="text-sm text-slate-500">{error}</p>
          </>
        ) : (
          <>
            <div className={`h-16 w-16 rounded-full flex items-center justify-center mx-auto ${ui.iconClass}`}>
              <Icon className="h-8 w-8" />
            </div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{result?.message || ui.title}</h1>
            {result?.amount != null && (
              <p className="text-sm text-slate-500">
                Сумма: {formatCurrency(result.amount)} {result.currency || 'BYN'}
              </p>
            )}
            {result?.status === 'pending' && (
              <p className="text-xs text-slate-400">
                Статус обновится автоматически после подтверждения банком. Можно закрыть страницу и зайти позже.
              </p>
            )}
          </>
        )}

        <Button asChild className="w-full bg-indigo-600 hover:bg-indigo-700">
          <Link to="/StudentDashboard">Вернуться в кабинет</Link>
        </Button>
      </div>
    </div>
  );
}
