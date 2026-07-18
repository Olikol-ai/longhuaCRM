import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { api } from '@/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  ASSIGNMENT_TARGET_LABEL,
  ASSIGNMENT_TARGET_OPTIONS,
  displayPersonName,
  fromDatetimeLocalValue,
} from '@/lib/assessment-admin';
import { unwrapItems } from '@/lib/assessment-ui';

export default function AssignmentCreateDialog({ open, onOpenChange, onCreated }) {
  const [exams, setExams] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loadingMeta, setLoadingMeta] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [examId, setExamId] = useState('');
  const [targetType, setTargetType] = useState('student');
  const [targetId, setTargetId] = useState('');
  const [validFrom, setValidFrom] = useState('');
  const [validTo, setValidTo] = useState('');
  const [ruleOverrideId, setRuleOverrideId] = useState('');

  const selectedExam = useMemo(
    () => exams.find((e) => e.id === examId) || null,
    [exams, examId],
  );

  const examRule = selectedExam?.rule || null;

  useEffect(() => {
    if (!open) return;
    setError(null);
    setExamId('');
    setTargetType('student');
    setTargetId('');
    setValidFrom('');
    setValidTo('');
    setRuleOverrideId('');
    setLoadingMeta(true);

    Promise.all([
      api.assessment.listExams({ status: 'published', limit: 200 }),
      api.students.list().catch(() => []),
      api.groups.list().catch(() => []),
      api.courses.list().catch(() => []),
    ])
      .then(([examsPayload, studentsPayload, groupsPayload, coursesPayload]) => {
        const published = unwrapItems(examsPayload);
        setExams(published);
        setExamId(published[0]?.id || '');
        setStudents(Array.isArray(studentsPayload) ? studentsPayload : unwrapItems(studentsPayload));
        setGroups(Array.isArray(groupsPayload) ? groupsPayload : unwrapItems(groupsPayload));
        setCourses(Array.isArray(coursesPayload) ? coursesPayload : unwrapItems(coursesPayload));
      })
      .catch((err) => setError(err?.message || 'Не удалось загрузить данные'))
      .finally(() => setLoadingMeta(false));
  }, [open]);

  useEffect(() => {
    setTargetId('');
  }, [targetType]);

  const targetOptions = useMemo(() => {
    if (targetType === 'student') {
      return students.map((s) => ({
        id: s.id,
        label: displayPersonName(s),
      }));
    }
    if (targetType === 'group') {
      return groups.map((g) => ({ id: g.id, label: g.name || g.id }));
    }
    if (targetType === 'course') {
      return courses.map((c) => ({
        id: c.id,
        label: c.name || c.course_name || c.id,
      }));
    }
    return [];
  }, [targetType, students, groups, courses]);

  const handleCreate = async () => {
    if (!examId) {
      setError('Выберите опубликованный экзамен');
      return;
    }
    if (!targetId.trim()) {
      setError('Выберите или укажите получателя');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const body = {
        exam_id: examId,
        target_type: targetType,
        target_id: targetId.trim(),
      };
      const from = fromDatetimeLocalValue(validFrom);
      const to = fromDatetimeLocalValue(validTo);
      if (from) body.valid_from = from;
      if (to) body.valid_to = to;
      if (ruleOverrideId.trim()) {
        body.assessment_rule_override_id = ruleOverrideId.trim();
      }

      const created = await api.assessment.createAssignment(body);
      onCreated?.(created);
      onOpenChange(false);
    } catch (err) {
      setError(err?.message || 'Не удалось создать назначение');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Новое назначение экзамена</DialogTitle>
        </DialogHeader>

        {loadingMeta ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Экзамен (опубликованный)</Label>
              <select
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                value={examId}
                onChange={(e) => setExamId(e.target.value)}
              >
                <option value="">Выберите экзамен</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.name}
                  </option>
                ))}
              </select>
              {exams.length === 0 && (
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  Нет опубликованных экзаменов
                </p>
              )}
            </div>

            {examRule && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 p-3 text-xs text-slate-600 dark:text-slate-300 space-y-1">
                <p className="font-medium text-slate-800 dark:text-slate-100">
                  Правило экзамена
                </p>
                <p>
                  Время: {examRule.duration_minutes ?? '—'} мин · Попыток:{' '}
                  {examRule.max_attempts ?? '—'} · Проходной:{' '}
                  {examRule.pass_score_percent ?? '—'}%
                </p>
                <p className="text-slate-400">
                  Лимит попыток задаётся в правилах экзамена (не отдельным полем
                  назначения).
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Тип получателя</Label>
                <select
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value)}
                >
                  {ASSIGNMENT_TARGET_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {ASSIGNMENT_TARGET_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <Label>Кому</Label>
                {targetType === 'corporate_group' ? (
                  <Input
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                    placeholder="UUID корп. группы"
                  />
                ) : (
                  <select
                    className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm"
                    value={targetId}
                    onChange={(e) => setTargetId(e.target.value)}
                  >
                    <option value="">Выберите…</option>
                    {targetOptions.map((opt) => (
                      <option key={opt.id} value={opt.id}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Действует с</Label>
                <Input
                  type="datetime-local"
                  value={validFrom}
                  onChange={(e) => setValidFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Действует до</Label>
                <Input
                  type="datetime-local"
                  value={validTo}
                  onChange={(e) => setValidTo(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Переопределение правила (необязательно)</Label>
              <Input
                value={ruleOverrideId}
                onChange={(e) => setRuleOverrideId(e.target.value)}
                placeholder="UUID правила, если нужен другой набор"
              />
            </div>

            {error && (
              <p className="text-sm text-rose-600 dark:text-rose-400" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            onClick={handleCreate}
            disabled={saving || loadingMeta || exams.length === 0}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Создание…
              </>
            ) : (
              'Назначить'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
