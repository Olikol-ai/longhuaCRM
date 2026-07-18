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
      <div className="flex min-h-screen items-center justify-center bg-slate-100 dark:bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-slate-700 dark:text-slate-300" />
      </div>
    );
  }

  if ((error && !cert) || !cert) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-100 p-6 dark:bg-slate-950">
        <p className="text-slate-600 dark:text-slate-400">{error || 'Сертификат не найден'}</p>
        <Button asChild variant="outline">
          <Link to={backPath}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-4 dark:bg-slate-950 sm:p-8">
      <div className="mx-auto mb-5 flex max-w-5xl flex-wrap items-center gap-2 print:hidden">
        <Button asChild variant="outline" size="sm" className="bg-white/80 dark:bg-slate-900/80">
          <Link to={backPath}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Назад
          </Link>
        </Button>
        {canPdf && (
          <>
            <Button
              size="sm"
              onClick={handleDownload}
              disabled={downloading || pdfLoading}
              className="gap-2 bg-slate-900 text-white hover:bg-slate-800"
            >
              {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Скачать PDF
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onClick={handlePrint}
              disabled={!pdfUrl || pdfLoading}
              className="gap-2 bg-white/90 dark:bg-slate-900/90"
            >
              <Printer className="h-4 w-4" />
              Печать
            </Button>
          </>
        )}
      </div>

      {canPdf ? (
        <div className="mx-auto max-w-5xl">
          {pdfLoading && (
            <div className="flex justify-center py-24">
              <Loader2 className="h-8 w-8 animate-spin text-slate-700 dark:text-slate-300" />
            </div>
          )}
          {error && !pdfUrl && !pdfLoading && (
            <p className="py-12 text-center text-red-600">{error}</p>
          )}
          {pdfUrl && (
            <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white p-2 shadow-xl sm:p-3">
              <iframe
                ref={iframeRef}
                title={`Сертификат ${cert.registration_number}`}
                src={pdfUrl}
                className="w-full rounded-xl bg-white"
                style={{ height: 'calc(100vh - 9rem)', minHeight: '760px' }}
                data-testid="certificate-pdf-frame"
              />
            </div>
          )}
          <p className="mx-auto mt-5 max-w-2xl text-center text-[11px] leading-relaxed text-slate-500 dark:text-slate-400 print:hidden">
            Данный сертификат не является сертификатом государственного образца и не
            предоставляет преимуществ, предусмотренных законодательством.
          </p>
        </div>
      ) : (
        <article
          className="relative mx-auto max-w-3xl overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 shadow-xl"
          data-testid="certificate-view"
        >
          <div className="absolute inset-x-10 top-6 h-px bg-rose-800" />
          <div className="flex flex-col items-center px-8 py-14 text-center sm:px-14 sm:py-16">
            <p className="mb-1 text-[11px] font-semibold tracking-[0.35em] text-rose-800">
              LONGHUA
            </p>
            <p className="mb-8 text-[10px] tracking-[0.28em] text-slate-500 dark:text-slate-400">
              CHINESE LANGUAGE SCHOOL
            </p>
            <h1 className="mb-3 text-3xl font-semibold tracking-[0.12em] text-slate-900 dark:text-slate-100 sm:text-4xl">
              СЕРТИФИКАТ
            </h1>
            <p className="mb-8 text-sm text-slate-500 dark:text-slate-400">
              PDF будет доступен после выдачи — {STATUS_LABEL[cert.status] || cert.status}
            </p>
            <div className="mb-6 w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-700 bg-white px-6 py-5">
              <p className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                {studentName || '—'}
              </p>
            </div>
            <p className="mb-2 text-sm text-slate-500 dark:text-slate-400">курс</p>
            <p className="mb-8 text-lg font-semibold text-slate-900 dark:text-slate-100">{courseName}</p>
            <p className="text-xs tracking-wide text-slate-400 dark:text-slate-500">
              Рег. № {cert.registration_number}
            </p>
          </div>
        </article>
      )}
    </div>
  );
}
