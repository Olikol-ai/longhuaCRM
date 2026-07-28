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

export default function TutorLessonModal({
  open,
  onClose,
  onSave,
  students,
  tutorId,
  defaultDate,
}) {
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
    setForm({
      tutor_student_id: '',
      date: defaultDate || new Date().toISOString().slice(0, 10),
      start_time: '10:00',
      duration: 60,
      notes: '',
    });
  }, [open, defaultDate]);

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
            <Label>Длительность (мин)</Label>
            <Input
              type="number"
              min={15}
              step={15}
              value={form.duration}
              onChange={(e) => setForm((f) => ({ ...f, duration: e.target.value }))}
            />
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
