import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from '@/components/ui/use-toast';
import CertificateStatusBadge, {
  CERTIFICATE_STATUS_LABEL,
} from '@/components/certificates/CertificateStatusBadge';

/**
 * Certificate view: for issued/sent/duplicate shows A4 PDF in-browser.
 * Draft/revoked keep a simple HTML fallback for admins.
 * Route: /certificate/:id
 */
export default function CertificateView() {
  const { id } = useParams();
  const { user } = useAuth();
  const [cert, setCert] = useState(null);
  const [courseName, setCourseName] = useState('');
  const [studentName, setStudentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pdfUrl, setPdfUrl] = useState('');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const iframeRef = useRef(null);
  const pdfUrlRef = useRef('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await api.certificates.get(id);
        if (cancelled) return;
        setCert(row);

        let courseLabel = 'Курс';
        try {
          const course = await api.courses.get(row.course_id);
          courseLabel = course?.name || course?.course_name || courseLabel;
        } catch {
          const courses = await api.courses.list().catch(() => []);
          const course = (courses || []).find((c) => c.id === row.course_id);
          courseLabel = course?.name || course?.course_name || courseLabel;
        }
        if (!cancelled) setCourseName(courseLabel);

        if (user?.role === 'student') {
          const me = await api.auth.me().catch(() => null);
          if (!cancelled) {
            setStudentName(
              me?.name ||
                me?.full_name ||
                [me?.last_name, me?.first_name].filter(Boolean).join(' ') ||
                me?.email ||
                '',
            );
          }
        } else {
          const students = await api.students.list().catch(() => []);
          const student = (students || []).find((s) => s.id === row.student_id);
          if (!cancelled) {
            setStudentName(student?.name || student?.email || row.student_id || '');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Сертификат недоступен');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, user?.role]);

  const canPdf =
    cert &&
    (cert.status === 'issued' || cert.status === 'sent' || cert.status === 'duplicate');

  useEffect(() => {
    if (!canPdf || !id) return undefined;
    let cancelled = false;
    setPdfLoading(true);
    (async () => {
      try {
        const blob = await api.certificates.downloadPdf(id);
        if (cancelled) return;
        if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
        const url = URL.createObjectURL(blob);
        pdfUrlRef.current = url;
        setPdfUrl(url);
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Не удалось загрузить PDF');
          setPdfUrl('');
        }
      } finally {
        if (!cancelled) setPdfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
      if (pdfUrlRef.current) {
        URL.revokeObjectURL(pdfUrlRef.current);
        pdfUrlRef.current = '';
      }
    };
  }, [canPdf, id]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = pdfUrl
        ? await fetch(pdfUrl).then((r) => r.blob())
        : await api.certificates.downloadPdf(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `certificate-${cert?.registration_number || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast({
        title: 'PDF недоступен',
        description: err?.message,
        variant: 'destructive',
      });
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
      return;
    }
    if (pdfUrl) {
      const w = window.open(pdfUrl, '_blank');
      if (w) {
        w.addEventListener('load', () => w.print());
      }
      return;
    }
    window.print();
  };

  const backPath =
    user?.role === 'student'
      ? '/StudentCertificates'
      : user?.role === 'admin'
        ? '/Certificates'
        : '/StudentDashboard';

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-brand" />
      </div>
    );
  }

  if ((error && !cert) || !cert) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <p className="text-muted-foreground">{error || 'Сертификат не найден'}</p>
        <Button asChild variant="outline" className="min-h-10">
          <Link to={backPath}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-background p-3 sm:p-6 lg:p-8 min-w-0 overflow-x-hidden">
      <div className="mx-auto mb-4 flex max-w-5xl flex-col gap-3 sm:mb-5 sm:flex-row sm:flex-wrap sm:items-center print:hidden">
        <Button asChild variant="outline" size="sm" className="min-h-10 w-full sm:w-auto">
          <Link to={backPath}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Link>
        </Button>
        {canPdf ? (
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloading || pdfLoading}
              className="gap-2 min-h-10 flex-1 sm:flex-none"
            >
              {downloading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Скачать PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrint}
              disabled={!pdfUrl || pdfLoading}
              className="gap-2 min-h-10 flex-1 sm:flex-none"
            >
              <Printer className="h-4 w-4" />
              Печать
            </Button>
          </div>
        ) : null}
      </div>

      {canPdf ? (
        <div className="mx-auto max-w-5xl min-w-0">
          {pdfLoading ? (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-brand" />
            </div>
          ) : null}
          {error && !pdfUrl && !pdfLoading ? (
            <p className="py-12 text-center text-destructive">{error}</p>
          ) : null}
          {pdfUrl ? (
            <Card className="overflow-hidden shadow-sm">
              <CardContent className="p-2 sm:p-3">
                <iframe
                  ref={iframeRef}
                  title={`Сертификат ${cert.registration_number}`}
                  src={pdfUrl}
                  className="w-full rounded-lg bg-white border border-border"
                  style={{ height: 'calc(100dvh - 10rem)', minHeight: '560px' }}
                  data-testid="certificate-pdf-frame"
                />
              </CardContent>
            </Card>
          ) : null}
          <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-relaxed text-muted-foreground print:hidden">
            Данный сертификат не является сертификатом государственного образца и не
            предоставляет преимуществ, предусмотренных законодательством.
          </p>
        </div>
      ) : (
        <Card
          className="relative mx-auto max-w-3xl overflow-hidden shadow-sm"
          data-testid="certificate-view"
        >
          <CardContent className="flex flex-col items-center px-6 py-12 text-center sm:px-12 sm:py-16">
            <p className="mb-1 text-[11px] font-semibold tracking-[0.35em] text-brand">
              LONGHUA
            </p>
            <p className="mb-6 text-[10px] tracking-[0.28em] text-muted-foreground">
              CHINESE LANGUAGE SCHOOL
            </p>
            <h1 className="mb-3 text-2xl font-semibold tracking-[0.08em] text-foreground sm:text-3xl">
              СЕРТИФИКАТ
            </h1>
            <div className="mb-8">
              <CertificateStatusBadge status={cert.status} />
            </div>
            <p className="mb-8 max-w-md text-sm text-muted-foreground">
              PDF будет доступен после выдачи —{' '}
              {CERTIFICATE_STATUS_LABEL[cert.status] || cert.status}
            </p>
            <div className="mb-6 w-full max-w-md rounded-xl border border-border bg-muted/40 px-6 py-5 min-w-0">
              <p
                className="text-xl font-semibold text-foreground break-words"
                title={studentName || undefined}
              >
                {studentName || '—'}
              </p>
            </div>
            <p className="mb-2 text-sm text-muted-foreground">курс</p>
            <p
              className="mb-8 text-lg font-semibold text-foreground break-words max-w-full"
              title={courseName}
            >
              {courseName}
            </p>
            <p className="text-xs tracking-wide text-muted-foreground break-all">
              Рег. № {cert.registration_number}
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
