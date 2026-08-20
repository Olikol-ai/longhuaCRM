import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Award,
  Ban,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { api } from '@/api';
import { toast } from '@/components/ui/use-toast';
import { resolveStudentLabel } from '@/lib/studentLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import PageHeader from '@/components/responsive/PageHeader';
import CertificateStatusBadge, {
  CERTIFICATE_STATUS_LABEL,
} from '@/components/certificates/CertificateStatusBadge';
import { cn } from '@/lib/utils';

const EMPTY_FORM = {
  student_id: '',
  course_id: '',
  registration_number: '',
  blank_series: '',
  blank_number: '',
  issue_date: '',
  status: 'draft',
};

const fieldClass =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

function todayLocalIsoDate() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function Certificates() {
  const [rows, setRows] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [banner, setBanner] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');

  const showBanner = (type, title, description = '') => {
    setBanner({ type, title, description });
  };

  const load = async () => {
    try {
      const [certs, sts, crs] = await Promise.all([
        api.certificates.list('-created_at'),
        api.students.list(),
        api.courses.list(),
      ]);
      setRows(Array.isArray(certs) ? certs : []);
      setStudents(Array.isArray(sts) ? sts : []);
      setCourses(Array.isArray(crs) ? crs : []);
    } catch (err) {
      const message = err?.message || 'Неизвестная ошибка';
      showBanner('error', 'Не удалось загрузить сертификаты', message);
      toast({
        title: 'Не удалось загрузить сертификаты',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const studentName = (id) => resolveStudentLabel(id, students);
  const courseName = (id) => {
    const c = courses.find((row) => row.id === id);
    return c?.name || c?.course_name || id;
  };

  const visibleRows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((cert) => {
      if (statusFilter && cert.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        cert.registration_number,
        cert.blank_series,
        cert.blank_number,
        studentName(cert.student_id),
        courseName(cert.course_id),
        CERTIFICATE_STATUS_LABEL[cert.status] || cert.status,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [rows, statusFilter, search, students, courses]);

  const handleCreate = async () => {
    setBanner(null);
    if (!form.student_id || !form.course_id || !form.registration_number.trim()) {
      showBanner(
        'error',
        'Заполните обязательные поля',
        'Нужны ученик, курс и регистрационный номер.',
      );
      toast({
        title: 'Заполните обязательные поля',
        description: 'Ученик, курс и регистрационный номер обязательны.',
        variant: 'destructive',
      });
      return;
    }
    setCreating(true);
    try {
      await api.certificates.create({
        student_id: form.student_id,
        course_id: form.course_id,
        registration_number: form.registration_number.trim(),
        blank_series: form.blank_series.trim() || undefined,
        blank_number: form.blank_number.trim() || undefined,
        issue_date: form.issue_date || undefined,
        status: 'draft',
      });
      setForm(EMPTY_FORM);
      await load();
      showBanner('success', 'Черновик сертификата создан');
      toast({ title: 'Черновик сертификата создан' });
    } catch (err) {
      const message = err?.message || 'Неизвестная ошибка';
      showBanner('error', 'Не удалось создать черновик', message);
      toast({
        title: 'Не удалось создать черновик',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleIssue = async (cert) => {
    setBanner(null);
    const issueDate = (cert.issue_date || form.issue_date || todayLocalIsoDate()).trim();
    const blankSeries = (cert.blank_series || form.blank_series || '').trim();
    const blankNumber = (cert.blank_number || form.blank_number || '').trim();

    if (!blankSeries || !blankNumber) {
      showBanner(
        'error',
        'Нужны серия и номер бланка',
        'Укажите их в форме сверху (или в черновике) и нажмите «Выдать» снова.',
      );
      toast({
        title: 'Нужны серия и номер бланка',
        description: 'Укажите серию и номер в форме выше или в черновике перед выдачей.',
        variant: 'destructive',
      });
      return;
    }

    setBusyId(cert.id);
    try {
      await api.certificates.update(cert.id, {
        status: 'issued',
        issue_date: issueDate,
        blank_series: blankSeries,
        blank_number: blankNumber,
      });
      await load();
      showBanner('success', 'Сертификат выдан', `Дата выдачи: ${issueDate}`);
      toast({ title: 'Сертификат выдан' });
    } catch (err) {
      const message = err?.message || 'Неизвестная ошибка';
      showBanner('error', 'Не удалось выдать сертификат', message);
      toast({
        title: 'Не удалось выдать сертификат',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (cert) => {
    setBanner(null);
    setBusyId(cert.id);
    try {
      await api.certificates.update(cert.id, { status: 'revoked' });
      await load();
      showBanner('success', 'Сертификат отозван');
      toast({ title: 'Сертификат отозван' });
    } catch (err) {
      const message = err?.message || 'Неизвестная ошибка';
      showBanner('error', 'Не удалось отозвать', message);
      toast({
        title: 'Не удалось отозвать',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (cert) => {
    setBanner(null);
    if (!confirm('Удалить сертификат?\n\nЭто действие нельзя отменить.')) {
      return;
    }
    setBusyId(cert.id);
    try {
      await api.certificates.delete(cert.id);
      await load();
      showBanner('success', 'Сертификат удалён');
      toast({ title: 'Сертификат удалён' });
    } catch (err) {
      const message = err?.message || 'Неизвестная ошибка';
      showBanner('error', 'Не удалось удалить сертификат', message);
      toast({
        title: 'Не удалось удалить сертификат',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20" data-testid="certificates-loading">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-6 lg:p-8 w-full max-w-6xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="certificates-page"
    >
      <PageHeader
        title="Сертификаты"
        description="Черновики, выдача и реестр сертификатов Longhua Academy"
      />

      {banner ? (
        <Alert
          variant={banner.type === 'error' ? 'destructive' : 'default'}
          className={cn(
            banner.type === 'success' &&
              'border-emerald-300/80 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100',
          )}
          data-testid="cert-banner"
        >
          <AlertTitle>{banner.title}</AlertTitle>
          {banner.description ? (
            <AlertDescription>{banner.description}</AlertDescription>
          ) : null}
        </Alert>
      ) : null}

      <Card className="min-w-0 overflow-hidden shadow-sm">
        <CardHeader className="space-y-1 p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">Новый черновик</CardTitle>
          <CardDescription>
            Укажите ученика, курс и регистрационный номер. Серию и номер бланка можно
            добавить сейчас или перед выдачей.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-2 min-w-0">
              <Label htmlFor="cert-student">Ученик *</Label>
              <select
                id="cert-student"
                className={fieldClass}
                value={form.student_id}
                onChange={(e) => setForm({ ...form, student_id: e.target.value })}
                data-testid="cert-student"
              >
                <option value="">Выберите ученика</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name || s.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="cert-course">Курс *</Label>
              <select
                id="cert-course"
                className={fieldClass}
                value={form.course_id}
                onChange={(e) => setForm({ ...form, course_id: e.target.value })}
                data-testid="cert-course"
              >
                <option value="">Выберите курс</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.course_name}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="cert-reg-number">Рег. номер *</Label>
              <Input
                id="cert-reg-number"
                className="h-11 md:h-10"
                placeholder="Например, LH-2026-001"
                value={form.registration_number}
                onChange={(e) =>
                  setForm({ ...form, registration_number: e.target.value })
                }
                data-testid="cert-reg-number"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="cert-blank-series">Серия бланка</Label>
              <Input
                id="cert-blank-series"
                className="h-11 md:h-10"
                placeholder="Серия"
                value={form.blank_series}
                onChange={(e) => setForm({ ...form, blank_series: e.target.value })}
                data-testid="cert-blank-series"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="cert-blank-number">Номер бланка</Label>
              <Input
                id="cert-blank-number"
                className="h-11 md:h-10"
                placeholder="Номер"
                value={form.blank_number}
                onChange={(e) => setForm({ ...form, blank_number: e.target.value })}
                data-testid="cert-blank-number"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <Label htmlFor="cert-issue-date">Дата выдачи</Label>
              <Input
                id="cert-issue-date"
                type="date"
                className="h-11 md:h-10"
                value={form.issue_date}
                onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
                data-testid="cert-issue-date"
              />
            </div>
          </div>

          {(students.length === 0 || courses.length === 0) && (
            <p className="mt-4 text-sm text-amber-800 dark:text-amber-200">
              {students.length === 0 ? 'Нет учеников для выбора. ' : null}
              {courses.length === 0
                ? 'Нет курсов — сначала создайте курс в «Материалы».'
                : null}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              className="gap-2 min-h-11 w-full sm:w-auto"
              disabled={creating}
              onClick={handleCreate}
              data-testid="cert-create-draft"
            >
              {creating ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              Создать черновик
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center min-w-0">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="h-11 pl-9 md:h-10"
            placeholder="Поиск по номеру, ученику или курсу…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            data-testid="cert-search"
          />
        </div>
        <select
          className={cn(fieldClass, 'sm:w-48 shrink-0')}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          data-testid="cert-status-filter"
          aria-label="Фильтр по статусу"
        >
          <option value="">Все статусы</option>
          {Object.entries(CERTIFICATE_STATUS_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {visibleRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/40 px-4 py-12 text-center space-y-3">
          <Award className="mx-auto h-10 w-10 text-muted-foreground/60" />
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-foreground">
              {rows.length === 0 ? 'Сертификатов пока нет' : 'Ничего не найдено'}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {rows.length === 0
                ? 'Создайте черновик выше — затем оформите выдачу с серией и номером бланка.'
                : 'Измените поисковый запрос или фильтр статуса.'}
            </p>
          </div>
        </div>
      ) : (
        <div className="space-y-3" data-testid="certificates-list">
          {visibleRows.map((cert) => {
            const name = studentName(cert.student_id);
            const course = courseName(cert.course_id);
            const blank =
              cert.blank_series || cert.blank_number
                ? `${cert.blank_series || '—'}-${cert.blank_number || '—'}`
                : null;
            return (
              <article
                key={cert.id}
                className="rounded-xl border border-border bg-card p-4 sm:p-5 shadow-sm min-w-0"
                data-testid={`cert-row-${cert.id}`}
              >
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2 min-w-0">
                      <Award className="h-4 w-4 shrink-0 text-brand" aria-hidden />
                      <h2 className="text-base font-semibold text-foreground truncate max-w-full">
                        {cert.registration_number}
                      </h2>
                      <CertificateStatusBadge status={cert.status} />
                    </div>
                    <dl className="grid grid-cols-1 gap-1.5 text-sm sm:grid-cols-2 min-w-0">
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Ученик</dt>
                        <dd className="font-medium text-foreground truncate" title={name}>
                          {name}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Курс</dt>
                        <dd className="font-medium text-foreground truncate" title={course}>
                          {course}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Дата выдачи</dt>
                        <dd className="text-foreground tabular-nums">
                          {cert.issue_date || '—'}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-xs text-muted-foreground">Бланк</dt>
                        <dd className="text-foreground truncate" title={blank || undefined}>
                          {blank || '—'}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0 w-full lg:w-auto lg:justify-end">
                    <Button asChild variant="outline" size="sm" className="gap-1.5 min-h-10">
                      <Link to={`/certificate/${cert.id}`}>
                        <ExternalLink className="h-3.5 w-3.5" />
                        Открыть
                      </Link>
                    </Button>
                    {cert.status === 'draft' ? (
                      <Button
                        type="button"
                        size="sm"
                        className="gap-1.5 min-h-10 bg-emerald-600 text-white hover:bg-emerald-700"
                        disabled={busyId === cert.id}
                        onClick={() => handleIssue(cert)}
                        data-testid={`cert-issue-${cert.id}`}
                      >
                        {busyId === cert.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        Выдать
                      </Button>
                    ) : null}
                    {cert.status === 'issued' || cert.status === 'sent' ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="gap-1.5 min-h-10"
                        disabled={busyId === cert.id}
                        onClick={() => handleRevoke(cert)}
                        data-testid={`cert-revoke-${cert.id}`}
                      >
                        <Ban className="h-3.5 w-3.5" />
                        Отозвать
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      variant="destructive"
                      className="gap-1.5 min-h-10"
                      disabled={busyId === cert.id}
                      onClick={() => handleDelete(cert)}
                      data-testid={`cert-delete-${cert.id}`}
                      title="Удалить сертификат навсегда"
                    >
                      {busyId === cert.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Trash2 className="h-3.5 w-3.5" />
                      )}
                      Удалить
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
