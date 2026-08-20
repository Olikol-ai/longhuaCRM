import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Award, Download, ExternalLink, Loader2, Sparkles } from 'lucide-react';
import { api } from '@/api';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import PageHeader from '@/components/responsive/PageHeader';
import CertificateStatusBadge from '@/components/certificates/CertificateStatusBadge';

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
          .sort((a, b) =>
            String(b.created_at || '').localeCompare(String(a.created_at || '')),
          );
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
    me?.name ||
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
      <div className="flex justify-center py-20" data-testid="student-certificates-loading">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const celebrationCertId = celebration?.reference_id || celebration?.referenceId;
  const viewPath = celebrationCertId
    ? `/certificate/${celebrationCertId}`
    : '/StudentCertificates';

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-5xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="student-certificates-page"
    >
      <PageHeader
        title="Мои сертификаты"
        description="Достижения Longhua Academy — сертификаты о прохождении курсов и экзаменов"
      />

      {celebration ? (
        <Card
          className="overflow-hidden border-brand/30 bg-brand/5 shadow-sm"
          data-testid="certificate-achievement-banner"
        >
          <CardHeader className="space-y-2 p-4 sm:p-6">
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-brand">
              <Sparkles className="h-3.5 w-3.5" />
              Достижение
            </p>
            <CardTitle className="text-lg sm:text-xl whitespace-pre-line break-words">
              {celebration.title}
            </CardTitle>
            <CardDescription className="text-sm text-foreground/80 whitespace-pre-line leading-relaxed">
              {celebration.body}
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex flex-wrap gap-2 p-4 pt-0 sm:p-6 sm:pt-0">
            <Button asChild className="gap-2 min-h-10">
              <Link to={viewPath} onClick={markCelebrationRead}>
                Открыть сертификат
              </Link>
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={markCelebrationRead}
            >
              Скрыть
            </Button>
          </CardFooter>
        </Card>
      ) : null}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center space-y-3">
          <Award className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              Пока нет выданных сертификатов
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Когда преподаватель оформит сертификат, он появится здесь.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {rows.map((cert) => {
            const course = courseName(cert.course_id);
            const blank =
              cert.blank_series || cert.blank_number
                ? `${cert.blank_series || '—'} · № ${cert.blank_number || '—'}`
                : 'Бланк не указан';
            return (
              <Card
                key={cert.id}
                className="flex h-full min-w-0 flex-col overflow-hidden shadow-sm"
                data-testid={`student-cert-card-${cert.id}`}
              >
                <CardHeader className="space-y-3 p-4 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted">
                      <img
                        src="/icons/icon-192.png?v=20260802c"
                        alt=""
                        className="h-8 w-8 object-contain"
                      />
                    </div>
                    <CertificateStatusBadge status={cert.status} />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Longhua Academy
                    </p>
                    <CardTitle
                      className="text-lg leading-snug break-words"
                      title={course}
                    >
                      {course}
                    </CardTitle>
                    <CardDescription className="truncate" title={studentName}>
                      {studentName}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex-1 space-y-2 p-4 pt-0 text-sm sm:p-6 sm:pt-0">
                  <div className="rounded-lg border border-border bg-muted/40 px-3 py-2.5 space-y-1">
                    <p className="text-muted-foreground truncate" title={blank}>
                      {blank}
                    </p>
                    <p className="tabular-nums text-foreground">
                      Дата выдачи: {cert.issue_date || '—'}
                    </p>
                    {cert.registration_number ? (
                      <p
                        className="text-xs text-muted-foreground truncate"
                        title={cert.registration_number}
                      >
                        Рег. № {cert.registration_number}
                      </p>
                    ) : null}
                  </div>
                </CardContent>
                <CardFooter className="flex flex-wrap gap-2 p-4 pt-0 sm:p-6 sm:pt-0">
                  <Button asChild className="gap-2 min-h-10 flex-1 sm:flex-none">
                    <Link to={`/certificate/${cert.id}`}>
                      <ExternalLink className="h-4 w-4" />
                      Открыть
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="gap-2 min-h-10 flex-1 sm:flex-none"
                    disabled={downloadingId === cert.id}
                    onClick={(e) => downloadPdf(cert.id, e)}
                  >
                    {downloadingId === cert.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    PDF
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}

      <p className="border-t border-border pt-4 text-center text-[11px] leading-relaxed text-muted-foreground max-w-2xl mx-auto">
        {DISCLAIMER}
      </p>
    </div>
  );
}
