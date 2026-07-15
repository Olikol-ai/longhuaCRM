import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { ArrowLeft, Download, Loader2, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';

const STATUS_LABEL = {
  draft: 'Черновик',
  issued: 'Выдан',
  sent: 'Отправлен',
  duplicate: 'Дубликат',
  revoked: 'Отозван',
};

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
      <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
      </div>
    );
  }

  if ((error && !cert) || !cert) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 p-6 bg-slate-100 dark:bg-slate-950">
        <p className="text-slate-600">{error || 'Сертификат не найден'}</p>
        <Button asChild variant="outline">
          <Link to={backPath}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Назад
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950 p-4 sm:p-6">
      <div className="max-w-5xl mx-auto mb-4 flex flex-wrap gap-2 print:hidden">
        <Button asChild variant="outline" size="sm">
          <Link to={backPath}>
            <ArrowLeft className="h-4 w-4 mr-2" /> Назад
          </Link>
        </Button>
        {canPdf && (
          <>
            <Button size="sm" onClick={handleDownload} disabled={downloading || pdfLoading} className="gap-2">
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Скачать PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrint}
              disabled={!pdfUrl || pdfLoading}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              Печать
            </Button>
          </>
        )}
      </div>

      {canPdf ? (
        <div className="max-w-5xl mx-auto">
          {pdfLoading && (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          )}
          {error && !pdfUrl && !pdfLoading && (
            <p className="text-center text-red-600 py-12">{error}</p>
          )}
          {pdfUrl && (
            <iframe
              ref={iframeRef}
              title={`Сертификат ${cert.registration_number}`}
              src={pdfUrl}
              className="w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white shadow-lg"
              style={{ height: 'calc(100vh - 8rem)', minHeight: '720px' }}
              data-testid="certificate-pdf-frame"
            />
          )}
          <p className="mt-4 text-[11px] leading-relaxed text-slate-500 text-center max-w-2xl mx-auto print:hidden">
            Данный сертификат не является сертификатом государственного образца и не
            предоставляет преимуществ, предусмотренных законодательством.
          </p>
        </div>
      ) : (
        <article
          className="relative max-w-3xl mx-auto min-h-[480px] bg-white dark:bg-slate-900 shadow-xl border border-slate-200 dark:border-slate-700 p-8 sm:p-12 flex flex-col items-center justify-center text-center"
          data-testid="certificate-view"
        >
          <p className="text-xs uppercase tracking-[0.35em] text-amber-900/70 mb-6">
            Longhua Chinese School
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-slate-900 dark:text-white mb-2">
            Сертификат
          </h1>
          <p className="text-sm text-slate-500 mb-6">
            PDF доступен после выдачи. Сейчас: {STATUS_LABEL[cert.status] || cert.status}
          </p>
          <p className="text-xl font-semibold text-indigo-900 dark:text-indigo-200 mb-4">
            {studentName || '—'}
          </p>
          <p className="text-lg font-bold text-slate-900 dark:text-white mb-6">{courseName}</p>
          <p className="text-xs text-slate-400">Рег. № {cert.registration_number}</p>
        </article>
      )}
    </div>
  );
}
