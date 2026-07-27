import { useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
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
    student_id: '',
    date: defaultDate || '',
    start_time: '10:00',
    duration: 60,
    lesson_format: 'online',
    meeting_link: '',
    notes: '',
  });

  useEffect(() => {
    if (!open) return;
    setForm({
      student_id: '',
      date: defaultDate || new Date().toISOString().slice(0, 10),
      start_time: '10:00',
      duration: 60,
      lesson_format: 'online',
      meeting_link: '',
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
    if (!form.student_id) {
      toast({ title: 'Выберите ученика', variant: 'destructive' });
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
        student_id: form.student_id,
        date: form.date,
        start_time: form.start_time,
        duration: Number(form.duration) || 60,
        lesson_type: 'individual',
        lesson_format: form.lesson_format,
        meeting_link: form.meeting_link || null,
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="space-y-2">
            <Label>Ученик *</Label>
            <Select
              value={form.student_id || 'none'}
              onValueChange={(v) => setForm((f) => ({ ...f, student_id: v === 'none' ? '' : v }))}
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

          <div className="grid grid-cols-2 gap-3">
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
              <Label>Формат</Label>
              <Select
                value={form.lesson_format}
                onValueChange={(v) => setForm((f) => ({ ...f, lesson_format: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="online">Онлайн</SelectItem>
                  <SelectItem value="offline">Офлайн</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>Ссылка на встречу</Label>
            <Input
              value={form.meeting_link}
              onChange={(e) => setForm((f) => ({ ...f, meeting_link: e.target.value }))}
              placeholder="https://..."
            />
          </div>

          <div className="space-y-2">
            <Label>Заметки</Label>
            <Textarea
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>Отмена</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Создать
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
