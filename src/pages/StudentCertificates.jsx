import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Award, Download, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';

const STATUS_LABEL = {
  draft: 'Черновик',
  issued: 'Выдан',
  sent: 'Отправлен',
  duplicate: 'Дубликат',
  revoked: 'Отозван',
};

const DISCLAIMER =
  'Данные сертификаты не являются сертификатами государственного образца и не предоставляют преимуществ, предусмотренных законодательством.';

export default function StudentCertificates() {
  const [rows, setRows] = useState([]);
  const [courses, setCourses] = useState([]);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [celebration, setCelebration] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [certs, crs, profile, notes] = await Promise.all([
          api.certificates.list(),
          api.courses.list().catch(() => []),
          api.auth.me().catch(() => null),
          api.notifications.list().catch(() => []),
        ]);
        if (cancelled) return;
        const visible = (Array.isArray(certs) ? certs : []).filter(
          (c) => c.status === 'issued' || c.status === 'sent' || c.status === 'duplicate',
        );
        setRows(visible);
        setCourses(Array.isArray(crs) ? crs : []);
        setMe(profile);

        const unread = (Array.isArray(notes) ? notes : [])
          .filter(
            (n) =>
              n.type === 'certificate_issued' &&
              n.channel === 'in_app' &&
              (n.status === 'pending' || n.status === 'sent'),
          )
          .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
        setCelebration(unread[0] || null);
      } catch (err) {
        toast({
          title: 'Не удалось загрузить сертификаты',
          description: err?.message,
          variant: 'destructive',
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const courseName = (id) => {
    const c = courses.find((row) => row.id === id);
    return c?.name || c?.course_name || 'Курс Longhua';
  };

  const studentName =
    me?.full_name ||
    [me?.last_name, me?.first_name].filter(Boolean).join(' ') ||
    me?.email ||
    'Ученик';

  const markCelebrationRead = async () => {
    if (!celebration?.id) return;
    try {
      await api.notifications.update(celebration.id, { status: 'read' });
    } catch {
      /* ignore */
    }
    setCelebration(null);
  };

  const downloadPdf = async (certId, event) => {
    event?.preventDefault?.();
    event?.stopPropagation?.();
    setDownloadingId(certId);
    try {
      const blob = await api.certificates.downloadPdf(certId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `longhua-certificate-${certId.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: 'Не удалось скачать PDF',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setDownloadingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const celebrationCertId = celebration?.reference_id || celebration?.referenceId;
  const viewPath = celebrationCertId
    ? `/certificate/${celebrationCertId}`
    : '/StudentCertificates';

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Мои сертификаты</h1>
        <p className="text-sm text-slate-500 mt-1">
          Достижения Longhua Academy — сертификаты о прохождении курсов и экзаменов
        </p>
      </div>

      {celebration && (
        <div
          className="relative overflow-hidden rounded-2xl border-2 border-amber-300/80 dark:border-amber-700 bg-gradient-to-br from-amber-50 via-white to-red-50 dark:from-slate-900 dark:via-slate-950 dark:to-red-950/40 p-5 sm:p-6 shadow-md"
          data-testid="certificate-achievement-banner"
        >
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-amber-200/40 blur-2xl" />
          <div className="relative space-y-3">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-amber-800 dark:text-amber-200">
              <Sparkles className="h-3.5 w-3.5" />
              Достижение
            </p>
            <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white whitespace-pre-line">
              {celebration.title}
            </h2>
            <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
              {celebration.body}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              <Button asChild className="bg-red-800 hover:bg-red-900 gap-2">
                <Link to={viewPath} onClick={markCelebrationRead}>
                  Открыть сертификат
                </Link>
              </Button>
              <Button type="button" variant="outline" onClick={markCelebrationRead}>
                Скрыть
              </Button>
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 dark:border-slate-700 p-12 text-center">
          <Award className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-slate-500">Пока нет выданных сертификатов</p>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-1 lg:grid-cols-2">
          {rows.map((cert) => (
            <article
              key={cert.id}
              className="relative overflow-hidden rounded-3xl border-2 border-amber-200/90 dark:border-amber-900/50 bg-gradient-to-br from-amber-50 via-white to-red-50 dark:from-slate-900 dark:via-slate-950 dark:to-red-950/30 p-6 sm:p-8 shadow-md"
              data-testid={`student-cert-card-${cert.id}`}
            >
              <div className="absolute inset-4 border border-amber-300/50 dark:border-amber-700/40 rounded-2xl pointer-events-none" />
              <div className="relative flex flex-col items-center text-center gap-4">
                <img
                  src="/icon-master.png"
                  alt="Longhua Academy"
                  className="h-16 w-16 sm:h-20 sm:w-20 object-contain drop-shadow-sm"
                />
                <p className="text-[11px] uppercase tracking-[0.22em] text-amber-900/70 dark:text-amber-200/70 font-semibold">
                  Longhua Academy · Достижение
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white leading-snug">
                  {courseName(cert.course_id)}
                </h2>
                <p className="text-sm text-slate-600 dark:text-slate-300">{studentName}</p>
                <div className="text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
                  <p>
                    Серия <span className="font-semibold text-slate-800 dark:text-slate-200">{cert.blank_series || '—'}</span>
                    {' · '}
                    № <span className="font-semibold text-slate-800 dark:text-slate-200">{cert.blank_number || '—'}</span>
                  </p>
                  <p>Дата выдачи: {cert.issue_date || '—'}</p>
                  <p className="inline-flex items-center rounded-full bg-amber-100/80 dark:bg-amber-900/40 px-3 py-0.5 text-xs font-medium text-amber-900 dark:text-amber-100">
                    {STATUS_LABEL[cert.status] || 'Статус неизвестен'}
                  </p>
                </div>
                <div className="flex flex-wrap justify-center gap-2 pt-2">
                  <Button asChild className="bg-red-800 hover:bg-red-900 gap-2">
                    <Link to={`/certificate/${cert.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      Открыть сертификат
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 border-amber-300 text-amber-950 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-100"
                    disabled={downloadingId === cert.id}
                    onClick={(e) => downloadPdf(cert.id, e)}
                  >
                    {downloadingId === cert.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Скачать PDF
                  </Button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="pt-4 text-[11px] leading-relaxed text-slate-500 text-center max-w-2xl mx-auto border-t border-slate-200 dark:border-slate-800">
        {DISCLAIMER}
      </p>
    </div>
  );
}
