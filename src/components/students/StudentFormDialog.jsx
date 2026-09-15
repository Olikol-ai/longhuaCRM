import React, { useState, useEffect } from 'react';
import {
  ResponsiveDialog,
  ResponsiveDialogFooter,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/responsive/ResponsiveDialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import AssignedTeacherSelect, {
  teacherOptionLabel,
} from '@/components/students/AssignedTeacherSelect';
import { api } from '@/api';
import { Loader2 } from 'lucide-react';
import { formatBelarusPhone, PHONE_PLACEHOLDER } from '@/utils/phone';
import { toast } from '@/components/ui/use-toast';
import { userFacingError } from '@/lib/userFacingError';

function emptyToNull(value) {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string' && value.trim() === '') return null;
  return value;
}

const nativeFieldClass =
  'h-11 min-h-11 w-full rounded-md border border-input bg-background px-3 text-base md:h-10 md:min-h-10 md:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

/**
 * Admin create/edit school Student card.
 * Teacher picker: same native select + api.teachers.list() as UserManagement / Groups.
 */
export default function StudentFormDialog({ open, onOpenChange, student, onSave }) {
  const [loading, setLoading] = useState(false);
  const [teachers, setTeachers] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    assigned_teacher: '',
    lesson_balance: 0,
    start_date: '',
    notes: '',
    status: 'active',
  });

  useEffect(() => {
    if (!open) return undefined;

    let cancelled = false;
    // Same source as UserManagement teacher filter. Keep null until loaded so
    // AssignedTeacherSelect does not treat initial [] as a final empty list.
    setTeachers(null);
    api.teachers
      .list()
      .then((rows) => {
        if (!cancelled) setTeachers(Array.isArray(rows) ? rows : []);
      })
      .catch(() => {
        if (!cancelled) setTeachers([]);
      });

    if (student) {
      setFormData({
        name: student.name || '',
        email: student.email || '',
        phone: student.phone || '',
        assigned_teacher: student.assigned_teacher || student.assigned_teacher_id || '',
        lesson_balance: student.lesson_balance ?? 0,
        start_date: student.start_date || '',
        notes: student.notes || '',
        status: student.status || 'active',
      });
    } else {
      setFormData({
        name: '',
        email: '',
        phone: '',
        assigned_teacher: '',
        lesson_balance: 0,
        start_date: new Date().toISOString().split('T')[0],
        notes: '',
        status: 'active',
      });
    }

    return () => {
      cancelled = true;
    };
  }, [open, student]);

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast({ title: 'Укажите имя ученика', variant: 'destructive' });
      return;
    }
    setLoading(true);
    try {
      const teacherId = emptyToNull(formData.assigned_teacher);
      const data = {
        name: formData.name.trim(),
        email: emptyToNull(formData.email),
        phone: formData.phone || '',
        // Mapped by domain-client to assignedTeacherId for POST/PATCH /students
        assigned_teacher: teacherId,
        lesson_balance: (() => {
          const raw = Number(formData.lesson_balance);
          return Number.isFinite(raw) ? Math.trunc(raw) : 0;
        })(),
        start_date: emptyToNull(formData.start_date),
        notes: formData.notes || '',
        status: formData.status || 'active',
      };
      if (!student && !teacherId && (!formData.status || formData.status === 'active')) {
        data.status = 'pending_assignment';
      }

      if (student) {
        await api.students.update(student.id, data);
        toast({ title: 'Изменения успешно сохранены' });
      } else {
        await api.students.create(data);
        const teacherName = teacherOptionLabel(
          (teachers || []).find((t) => String(t.id) === String(teacherId)),
        );
        toast({
          title: teacherName
            ? `Ученик создан и назначен: ${teacherName}`
            : 'Ученик создан (преподаватель не назначен)',
          description: formData.email.trim()
            ? 'Вход в CRM — регистрация с этим email и подтверждение почты.'
            : 'Карточка без аккаунта. Вход — обычная регистрация или ссылка преподавателя.',
        });
      }
      await onSave?.();
      onOpenChange(false);
    } catch (err) {
      toast({
        title: 'Не удалось сохранить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange} className="sm:max-w-lg" fullscreenOnMobile>
      <ResponsiveDialogHeader>
        <ResponsiveDialogTitle>
          {student ? 'Редактировать ученика' : 'Создать ученика'}
        </ResponsiveDialogTitle>
      </ResponsiveDialogHeader>

      <div className="space-y-4 py-2">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="student-form-name">Имя *</Label>
            <Input
              id="student-form-name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Полное имя"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-form-email">Эл. почта</Label>
            <Input
              id="student-form-email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="ivan@example.com"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-form-phone">Телефон</Label>
          <Input
            id="student-form-phone"
            value={formData.phone}
            onChange={(e) => setFormData({ ...formData, phone: formatBelarusPhone(e.target.value) })}
            placeholder={PHONE_PLACEHOLDER}
          />
        </div>

        <AssignedTeacherSelect
          id="student-form-teacher"
          label="Преподаватель"
          value={formData.assigned_teacher}
          onChange={(teacherId) => setFormData({ ...formData, assigned_teacher: teacherId })}
          emptyLabel="Не назначен"
          data-testid="student-form-teacher"
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="student-form-start">Дата начала</Label>
            <Input
              id="student-form-start"
              type="date"
              value={formData.start_date}
              onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="student-form-balance">Баланс уроков</Label>
            <Input
              id="student-form-balance"
              type="number"
              step={1}
              value={formData.lesson_balance}
              onChange={(e) => setFormData({ ...formData, lesson_balance: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-form-status">Статус</Label>
          <select
            id="student-form-status"
            className={nativeFieldClass}
            value={formData.status}
            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
          >
            <option value="active">Активный</option>
            <option value="pending_assignment">Ожидает назначения</option>
            <option value="inactive">Неактивный</option>
            <option value="paused">Пауза</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="student-form-notes">Заметки</Label>
          <Textarea
            id="student-form-notes"
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Дополнительные заметки..."
            rows={3}
          />
        </div>

        {!student && (
          <p className="text-xs text-muted-foreground rounded-lg border border-border bg-muted/40 px-3 py-2">
            Создаётся школьная карточка ученика. Вход в CRM — через обычную регистрацию
            (тот же email) или ссылку-приглашение преподавателя.
          </p>
        )}
      </div>

      <ResponsiveDialogFooter>
        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
          Отмена
        </Button>
        <Button
          type="button"
          onClick={handleSubmit}
          disabled={loading || !formData.name}
          className="bg-primary hover:bg-primary/90"
          data-testid="student-form-save"
        >
          {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {student ? 'Сохранить' : 'Создать'}
        </Button>
      </ResponsiveDialogFooter>
    </ResponsiveDialog>
  );
}
