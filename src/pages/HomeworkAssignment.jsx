import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/use-toast';
import { createPageUrl } from '@/utils';
import { userFacingError } from '@/lib/userFacingError';

const fieldClass =
  'w-full min-h-11 h-11 px-3 text-base border rounded-lg bg-background md:min-h-9 md:h-9 md:text-sm';

export default function HomeworkAssignment() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [params] = useSearchParams();
  const homeworkId = params.get('homeworkId');
  const lessonId = params.get('lessonId');
  const preselectStudent = params.get('studentId');
  const isTutor = user?.role === 'tutor';

  const [homeworks, setHomeworks] = useState([]);
  const [selectedHw, setSelectedHw] = useState(homeworkId || '');
  const [students, setStudents] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(preselectStudent ? [preselectStudent] : []);
  const [dueAt, setDueAt] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [hw, st] = await Promise.all([
          api.homework.list(),
          isTutor ? api.tutors.myStudents() : (api.students.list?.() ?? api.students.filter({})),
        ]);
        const hwRows = (Array.isArray(hw) ? hw : []).filter((h) => h.status === 'published');
        setHomeworks(hwRows);
        if (!selectedHw && hwRows[0]) setSelectedHw(hwRows[0].id);
        const stRows = Array.isArray(st) ? st : st?.items || [];
        setStudents(
          stRows
            .filter((row) => row.status !== 'inactive')
            .map((row) => {
              const hasAccount = Boolean(row.user_id || row.userId);
              return {
                id: row.id,
                name:
                  row.name ||
                  row.full_name ||
                  [row.last_name, row.first_name].filter(Boolean).join(' ') ||
                  row.email,
                learnerType: isTutor ? 'tutor_student' : 'student',
                hasAccount,
                kindLabel: hasAccount ? 'Зарегистрированный' : 'Добавлен вручную',
              };
            }),
        );
      } catch (err) {
        toast({
          title: 'Ошибка загрузки',
          description: userFacingError(err),
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    })();
  }, [isTutor]);

  const toggleStudent = (id) => {
    setSelectedStudents((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const handleAssign = async () => {
    if (!selectedHw) {
      toast({ title: 'Выберите задание', variant: 'destructive' });
      return;
    }
    if (!selectedStudents.length) {
      toast({ title: 'Выберите учеников', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const selected = students.filter((student) => selectedStudents.includes(student.id));
      await api.homework.assign(selectedHw, {
        student_ids: selected
          .filter((student) => student.learnerType === 'student')
          .map((student) => student.id),
        tutor_student_ids: selected
          .filter((student) => student.learnerType === 'tutor_student')
          .map((student) => student.id),
        due_at: dueAt ? new Date(dueAt).toISOString() : undefined,
        lesson_id: lessonId || undefined,
      });
      toast({
        title: 'Задание назначено',
        description: isTutor
          ? 'Зарегистрированные ученики получат уведомление. Для локальных учеников статус отмечается вручную.'
          : 'Ученики получат уведомление.',
      });
      navigate(createPageUrl('HomeworkResults') + `?homeworkId=${selectedHw}`);
    } catch (err) {
      toast({
        title: 'Не удалось назначить',
        description: userFacingError(err),
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  return (
    <div
      className="p-3 sm:p-6 w-full max-w-3xl mx-auto space-y-4 sm:space-y-6 min-w-0 overflow-x-hidden"
      data-testid="homework-assignment"
    >
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold break-words">Назначить домашнее задание</h1>
        <p className="text-sm text-slate-500 mt-1 break-words">
          Выберите готовое задание или{' '}
          <button
            type="button"
            className="text-brand underline min-h-11 inline-flex items-center"
            onClick={() => navigate(createPageUrl('HomeworkEditor'))}
          >
            создайте новое
          </button>
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border p-4 sm:p-5 space-y-4 min-w-0">
        <div className="min-w-0">
          <label className="block text-xs font-medium mb-1">Задание</label>
          <select
            value={selectedHw}
            onChange={(e) => setSelectedHw(e.target.value)}
            className={fieldClass}
          >
            <option value="">— выберите —</option>
            {homeworks.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          <label className="block text-xs font-medium mb-1">Срок выполнения</label>
          <input
            type="datetime-local"
            value={dueAt}
            onChange={(e) => setDueAt(e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <label className="block text-xs font-medium">Ученики</label>
            <span className="text-xs text-slate-500">
              Выбрано: {selectedStudents.length} / {students.length}
            </span>
          </div>
          {students.length === 0 ? (
            <p className="text-sm text-slate-500 border rounded-lg p-4">
              Нет доступных учеников для назначения.
            </p>
          ) : (
            <div className="max-h-[min(24rem,55vh)] overflow-y-auto overscroll-contain border rounded-lg p-2 grid grid-cols-1 sm:grid-cols-2 gap-1">
              {students.map((s) => {
                const checked = selectedStudents.includes(s.id);
                return (
                  <label
                    key={s.id}
                    className={`flex items-start gap-3 min-h-11 text-sm p-2.5 rounded-lg cursor-pointer min-w-0 ${
                      checked
                        ? 'bg-brand/10 border border-brand/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800 border border-transparent'
                    }`}
                  >
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 shrink-0"
                      checked={checked}
                      onChange={() => toggleStudent(s.id)}
                    />
                    <span className="min-w-0 break-words">
                      <span className="font-medium block">{s.name}</span>
                      <span className="text-xs text-slate-500">{s.kindLabel}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
        <Button
          variant="outline"
          className="w-full sm:w-auto"
          onClick={() => navigate(createPageUrl('HomeworkList'))}
        >
          Отмена
        </Button>
        <Button disabled={saving} className="w-full sm:w-auto" onClick={handleAssign}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Назначить'}
        </Button>
      </div>
    </div>
  );
}
