import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/api';
import { Plus, Award, CheckCircle2, Ban, Trash2, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { resolveStudentLabel } from '@/lib/studentLabels';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const EMPTY_FORM = {
  student_id: '',
  course_id: '',
  registration_number: '',
  blank_series: '',
  blank_number: '',
  issue_date: '',
  status: 'draft',
};

const STATUS_LABEL = {
  draft: 'Черновик',
  issued: 'Выдан',
  sent: 'Отправлен',
  duplicate: 'Дубликат',
  revoked: 'Отозван',
};

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
    const issueDate =
      (cert.issue_date || form.issue_date || todayLocalIsoDate()).trim();
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

  const studentName = (id) => resolveStudentLabel(id, students);
  const courseName = (id) => {
    const c = courses.find((row) => row.id === id);
    return c?.name || c?.course_name || id;
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Сертификаты</h2>
        <p className="text-sm text-muted-foreground">
          Создание черновиков, привязка к ученику и курсу, ручная дата выдачи
        </p>
      </div>

      {banner && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.type === 'error'
              ? 'border-red-300 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100'
              : 'border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100'
          }`}
          data-testid="cert-banner"
        >
          <p className="font-semibold">{banner.title}</p>
          {banner.description ? (
            <p className="mt-1 opacity-90">{banner.description}</p>
          ) : null}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 p-4 border rounded-xl bg-card items-end">
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground" htmlFor="cert-student">
            Ученик *
          </label>
          <select
            id="cert-student"
            className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background"
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
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground" htmlFor="cert-course">
            Курс *
          </label>
          <select
            id="cert-course"
            className="w-full h-9 border border-input rounded-md px-3 text-sm bg-background"
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
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground" htmlFor="cert-reg-number">
            Рег. номер *
          </label>
          <Input
            id="cert-reg-number"
            placeholder="Например, LH-2026-001"
            value={form.registration_number}
            onChange={(e) => setForm({ ...form, registration_number: e.target.value })}
            data-testid="cert-reg-number"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground" htmlFor="cert-blank-series">
            Серия бланка
          </label>
          <Input
            id="cert-blank-series"
            placeholder="Серия"
            value={form.blank_series}
            onChange={(e) => setForm({ ...form, blank_series: e.target.value })}
            data-testid="cert-blank-series"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground" htmlFor="cert-blank-number">
            Номер бланка
          </label>
          <Input
            id="cert-blank-number"
            placeholder="Номер"
            value={form.blank_number}
            onChange={(e) => setForm({ ...form, blank_number: e.target.value })}
            data-testid="cert-blank-number"
          />
        </div>
        <div className="space-y-1">
          <label className="block text-xs text-muted-foreground" htmlFor="cert-issue-date">
            Дата выдачи
          </label>
          <Input
            id="cert-issue-date"
            type="date"
            value={form.issue_date}
            onChange={(e) => setForm({ ...form, issue_date: e.target.value })}
            data-testid="cert-issue-date"
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <Button
            type="button"
            onClick={handleCreate}
            disabled={creating}
            className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 gap-2"
            data-testid="cert-create-draft"
          >
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Создать черновик
          </Button>
        </div>
        {(students.length === 0 || courses.length === 0) && (
          <p className="sm:col-span-2 lg:col-span-3 text-xs text-amber-700 dark:text-amber-300">
            {students.length === 0 && 'Нет учеников для выбора. '}
            {courses.length === 0 && 'Нет активных курсов — сначала создайте курс в «Материалы».'}
          </p>
        )}
      </div>

      <div className="space-y-2">
        {rows.length === 0 && (
          <p className="text-sm text-muted-foreground py-8 text-center">Сертификатов пока нет</p>
        )}
        {rows.map((cert) => (
          <div
            key={cert.id}
            className="border rounded-xl p-4 bg-card flex flex-col sm:flex-row sm:items-center justify-between gap-4"
          >
            <div>
              <p className="font-semibold flex items-center gap-2">
                <Award className="w-4 h-4 text-indigo-600" /> {cert.registration_number}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {studentName(cert.student_id)} · {courseName(cert.course_id)} ·{' '}
                {STATUS_LABEL[cert.status] || cert.status}
                {cert.issue_date ? ` · выдан ${cert.issue_date}` : ''}
                {cert.blank_series ? ` · ${cert.blank_series}-${cert.blank_number}` : ''}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <Button asChild variant="outline" size="sm" className="gap-1">
                <Link to={`/certificate/${cert.id}`}>
                  <ExternalLink className="w-3 h-3" /> Открыть
                </Link>
              </Button>
              {cert.status === 'draft' && (
                <Button
                  type="button"
                  size="sm"
                  className="bg-emerald-600 hover:bg-emerald-700 gap-1"
                  disabled={busyId === cert.id}
                  onClick={() => handleIssue(cert)}
                  data-testid={`cert-issue-${cert.id}`}
                >
                  {busyId === cert.id ? (
                    <Loader2 className="w-3 h-3 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3 h-3" />
                  )}
                  Выдать
                </Button>
              )}
              {(cert.status === 'issued' || cert.status === 'sent') && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1 text-amber-700"
                  disabled={busyId === cert.id}
                  onClick={() => handleRevoke(cert)}
                  data-testid={`cert-revoke-${cert.id}`}
                >
                  <Ban className="w-3 h-3" /> Отозвать
                </Button>
              )}
              <Button
                type="button"
                size="sm"
                variant="destructive"
                className="gap-1"
                disabled={busyId === cert.id}
                onClick={() => handleDelete(cert)}
                data-testid={`cert-delete-${cert.id}`}
                title="Удалить сертификат навсегда"
              >
                {busyId === cert.id ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Trash2 className="w-3 h-3" />
                )}
                Удалить
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
