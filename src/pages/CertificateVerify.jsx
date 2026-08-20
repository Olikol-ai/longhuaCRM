import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api';
import { Check, Loader2, ShieldAlert, ShieldX } from 'lucide-react';

const FONT_HREF =
  'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Great+Vibes&family=Source+Sans+3:wght@400;600&display=swap';

function useVerifyFonts() {
  useEffect(() => {
    const id = 'certificate-verify-fonts';
    if (document.getElementById(id)) return undefined;
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = FONT_HREF;
    document.head.appendChild(link);
    return undefined;
  }, []);
}

function formatIssueDate(value) {
  if (!value) return '—';
  try {
    return new Date(`${value}T12:00:00`).toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  } catch {
    return value;
  }
}

/**
 * Public landing page for certificate QR scans.
 * Route: /verify/certificate/:id
 */
export default function CertificateVerify() {
  useVerifyFonts();
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const row = await api.certificates.verify(id);
        if (!cancelled) setData(row);
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err?.message || 'Сертификат не найден в реестре');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const valid = Boolean(data?.valid);
  const issuer = data?.issuer || {};

  return (
    <div
      className="min-h-screen px-4 py-10 sm:py-16 bg-gradient-to-b from-muted via-muted to-background"
      style={{
        fontFamily: '"Source Sans 3", "Segoe UI", sans-serif',
      }}
    >
      <div className="mx-auto w-full max-w-lg">
        <header className="mb-8 text-center">
          <p
            className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground"
            style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
          >
            Longhua Academy
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Проверка подлинности сертификата</p>
        </header>

        <div className="relative overflow-hidden rounded-3xl border border-slate-200/80 bg-card shadow-xl shadow-slate-900/10">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-1.5"
            style={{
              background: valid
                ? 'linear-gradient(90deg, #047857, #10b981, #047857)'
                : 'linear-gradient(90deg, #991b1b, #dc2626, #991b1b)',
            }}
          />

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-foreground" />
              <p className="text-sm">Сверяем с реестром…</p>
            </div>
          ) : error ? (
            <div className="px-6 py-12 text-center sm:px-10">
              <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-muted ring-8 ring-slate-50 dark:ring-slate-800">
                <ShieldX className="h-12 w-12 text-muted-foreground" strokeWidth={1.75} />
              </div>
              <h1
                className="text-2xl sm:text-3xl font-semibold text-foreground"
                style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
              >
                Сертификат не найден
              </h1>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{error}</p>
            </div>
          ) : (
            <div className="px-6 py-10 sm:px-10 sm:py-12">
              <div className="flex flex-col items-center text-center">
                {valid ? (
                  <div
                    className="relative mb-6 flex h-28 w-28 items-center justify-center rounded-full"
                    style={{
                      background:
                        'radial-gradient(circle at 30% 30%, #6ee7b7, #059669 55%, #047857)',
                      boxShadow: '0 16px 40px rgba(4, 120, 87, 0.35)',
                      animation: 'cert-pop 0.55s cubic-bezier(0.22, 1, 0.36, 1)',
                    }}
                  >
                    <Check className="h-14 w-14 text-white" strokeWidth={2.75} />
                  </div>
                ) : (
                  <div className="mb-6 flex h-28 w-28 items-center justify-center rounded-full bg-red-50 ring-8 ring-red-50/80 dark:bg-red-950/40 dark:ring-red-950/40">
                    <ShieldAlert className="h-14 w-14 text-red-700 dark:text-red-300" strokeWidth={1.75} />
                  </div>
                )}

                <h1
                  className="text-3xl sm:text-4xl font-semibold tracking-tight text-foreground"
                  style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                >
                  {valid ? 'Сертификат действителен' : 'Сертификат недействителен'}
                </h1>
                <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
                  {data?.message}
                </p>
              </div>

              <dl className="mt-10 space-y-3 rounded-2xl bg-muted px-5 py-5 text-left">
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Получатель
                  </dt>
                  <dd className="text-sm font-semibold text-foreground sm:text-right break-words min-w-0">
                    {data?.student_name || '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Курс
                  </dt>
                  <dd className="text-sm font-semibold text-foreground sm:text-right break-words min-w-0">
                    {data?.course_name || '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Рег. номер
                  </dt>
                  <dd className="font-mono text-sm font-semibold text-foreground sm:text-right break-all min-w-0">
                    {data?.registration_number || '—'}
                  </dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:flex-row sm:justify-between sm:gap-4">
                  <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Дата выдачи
                  </dt>
                  <dd className="text-sm font-semibold text-foreground sm:text-right">
                    {formatIssueDate(data?.issue_date)}
                  </dd>
                </div>
              </dl>

              {valid && (
                <div className="mt-10 border-t border-border pt-8 text-center">
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {issuer.title || 'Директор'}
                  </p>
                  <p
                    className="mt-2 text-lg font-semibold text-foreground"
                    style={{ fontFamily: '"Cormorant Garamond", Georgia, serif' }}
                  >
                    {issuer.organization || 'ЧУП «ДатаВэйв Солюшнс»'}
                  </p>
                  <p
                    className="mt-4 text-4xl text-foreground"
                    style={{
                      fontFamily: '"Great Vibes", cursive',
                      lineHeight: 1.2,
                    }}
                  >
                    {issuer.director || 'Янчиленко И.А.'}
                  </p>
                  <div className="mx-auto mt-2 h-px w-40 bg-gradient-to-r from-transparent via-slate-400 to-transparent" />
                  <p className="mt-2 text-sm font-medium text-foreground">
                    {issuer.director || 'Янчиленко И.А.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-xs text-muted-foreground">
          Официальная проверка реестра сертификатов{' '}
          <Link to="/login" className="font-medium text-foreground underline-offset-2 hover:underline">
            Longhua Academy
          </Link>
        </p>
      </div>

      <style>{`
        @keyframes cert-pop {
          0% { transform: scale(0.6); opacity: 0; }
          70% { transform: scale(1.06); opacity: 1; }
          100% { transform: scale(1); }
        }
      `}</style>
    </div>
  );
}
