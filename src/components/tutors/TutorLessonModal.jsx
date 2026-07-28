import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Loader2, X } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import { toLessonWritePayload } from '@/lib/lessonPayload';
import { createPageUrl } from '@/utils';

const FALLBACK_DURATIONS = [30, 60, 90, 120];

function resolveDurations(tutor) {
  const rows = tutor?.lesson_durations || tutor?.lessonDurations || [];
  const minutes = rows
    .map((r) => Number(typeof r === 'number' ? r : r?.minutes))
    .filter((n) => FALLBACK_DURATIONS.includes(n));
  return minutes.length ? [...new Set(minutes)].sort((a, b) => a - b) : FALLBACK_DURATIONS;
}

function resolveWorkDays(tutor) {
  const rows = tutor?.work_days || tutor?.workDays || [];
  return rows
    .map((r) => Number(typeof r === 'number' ? r : r?.day_of_week ?? r?.dayOfWeek))
    .filter((n) => n >= 0 && n <= 6);
}

/** JS getDay(): 0=Sun … 6=Sat → our 0=Mon … 6=Sun */
function toWorkDayIndex(dateStr) {
  const d = new Date(`${dateStr}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const js = d.getDay();
  return js === 0 ? 6 : js - 1;
}

function timeToMinutes(value) {
  const m = /^(\d{2}):(\d{2})/.exec(String(value || ''));
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
}

export default function TutorLessonModal({
  open,
  onClose,
  onSave,
  students,
  tutorId,
  tutor,
  defaultDate,
}) {
  const durations = useMemo(() => resolveDurations(tutor), [tutor]);
  const workDays = useMemo(() => resolveWorkDays(tutor), [tutor]);
  const workFrom = String(tutor?.work_time_from || tutor?.workTimeFrom || '').slice(0, 5);
  const workTo = String(tutor?.work_time_to || tutor?.workTimeTo || '').slice(0, 5);

  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    tutor_student_id: '',
    date: defaultDate || '',
    start_time: '10:00',
    duration: 60,
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    const preferred = durations.includes(60) ? 60 : durations[0];
    setForm({
      tutor_student_id: '',
      date: defaultDate || new Date().toISOString().slice(0, 10),
      start_time: workFrom || '10:00',
      duration: preferred,
      notes: '',
    });
  }, [open, defaultDate, durations, workFrom]);

  const activeStudents = useMemo(
    () => (Array.isArray(students) ? students : []).filter((s) => s.status !== 'inactive'),
    [students],
  );

  if (!open) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tutorId) {
      toast({ title: 'Профиль репетитора не найден', variant: 'destructive' });
      return;
    }
    if (!form.tutor_student_id) {
      toast({ title: 'Выберите ученика из блокнота', variant: 'destructive' });
      return;
    }
    if (!form.date || !form.start_time) {
      toast({ title: 'Укажите дату и время', variant: 'destructive' });
      return;
    }

    if (workDays.length > 0) {
      const dayIdx = toWorkDayIndex(form.date);
      if (dayIdx != null && !workDays.includes(dayIdx)) {
        toast({
          title: 'День вне рабочих дней',
          description: 'Выберите дату из ваших рабочих дней в профиле',
          variant: 'destructive',
        });
        return;
      }
    }

    if (workFrom && workTo) {
      const start = timeToMinutes(form.start_time);
      const from = timeToMinutes(workFrom);
      const to = timeToMinutes(workTo);
      if (start != null && from != null && to != null && (start < from || start > to)) {
        toast({
          title: 'Время вне рабочего окна',
          description: `Рабочее время: ${workFrom}–${workTo}`,
          variant: 'destructive',
        });
        return;
      }
    }

    setSaving(true);
    try {
      const payload = toLessonWritePayload({
        tutor_id: tutorId,
        tutor_student_id: form.tutor_student_id,
        date: form.date,
        start_time: form.start_time,
        duration: Number(form.duration) || 60,
        lesson_type: 'individual',
        lesson_format: 'online',
        notes: form.notes || null,
      });
      await onSave(payload);
      onClose();
    } catch (err) {
      toast({
        title: 'Не удалось создать занятие',
        description: err?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-0 sm:p-4">
      <div className="w-full sm:max-w-lg bg-white dark:bg-slate-900 rounded-t-2xl sm:rounded-2xl shadow-xl border border-slate-200 dark:border-slate-800 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">Новое занятие</h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4" data-testid="tutor-lesson-form">
          <div className="space-y-2">
            <Label>Ученик из блокнота *</Label>
            {activeStudents.length === 0 ? (
              <p className="text-sm text-slate-500">
                Сначала добавьте запись в{' '}
                <Link
                  to={createPageUrl('TutorStudents')}
                  className="text-brand underline"
                  onClick={onClose}
                >
                  Ученики
                </Link>
              </p>
            ) : (
              <Select
                value={form.tutor_student_id || 'none'}
                onValueChange={(v) => setForm((f) => ({ ...f, tutor_student_id: v === 'none' ? '' : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Выбрать ученика" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Выбрать ученика</SelectItem>
                  {activeStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Дата *</Label>
              <Input
                type="date"
                value={form.date}
                onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Время *</Label>
              <Input
                type="time"
                value={form.start_time}
                onChange={(e) => setForm((f) => ({ ...f, start_time: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Длительность</Label>
            <Select
              value={String(form.duration)}
              onValueChange={(v) => setForm((f) => ({ ...f, duration: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {durations.map((minutes) => (
                  <SelectItem key={minutes} value={String(minutes)}>
                    {minutes} минут
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Комментарий</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
              placeholder="Необязательно"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={saving || activeStudents.length === 0}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Создать
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
