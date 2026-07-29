import { useEffect, useMemo, useState } from "react";
import { Loader2, Users, X } from "lucide-react";
import { api } from "@/api";
import { toast } from "@/components/ui/use-toast";
import { displayName } from "@/lib/ownerStudents";

const actionBtnBase =
  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-center whitespace-normal leading-snug";

function resolveCurrentTargetKey(lesson) {
  if (lesson?.primary_student_id || lesson?.primaryStudentId) {
    return `student:${lesson.primary_student_id || lesson.primaryStudentId}`;
  }
  if (lesson?.primary_tutor_student_id || lesson?.primaryTutorStudentId) {
    return `tutor_student:${lesson.primary_tutor_student_id || lesson.primaryTutorStudentId}`;
  }
  if (
    lesson?.primary_teacher_student_contact_id ||
    lesson?.primaryTeacherStudentContactId
  ) {
    return `teacher_student_contact:${
      lesson.primary_teacher_student_contact_id ||
      lesson.primaryTeacherStudentContactId
    }`;
  }
  return "";
}

function buildOptions({ students, contacts, tutorStudents, isTutorLesson }) {
  const options = [];

  if (!isTutorLesson) {
    for (const student of students || []) {
      if (student.status === "inactive") continue;
      options.push({
        key: `student:${student.id}`,
        label: `${displayName(student)} (CRM)`,
        payload: { student_id: student.id },
      });
    }
  }

  for (const contact of contacts || []) {
    if (contact.status === "inactive") continue;
    options.push({
      key: `teacher_student_contact:${contact.id}`,
      label: `${displayName(contact)} (личный)`,
      payload: { teacher_student_contact_id: contact.id },
    });
  }

  if (isTutorLesson) {
    for (const row of tutorStudents || []) {
      if (row.status === "inactive") continue;
      options.push({
        key: `tutor_student:${row.id}`,
        label: `${displayName(row)} (блокнот)`,
        payload: { tutor_student_id: row.id },
      });
    }
  }

  return options;
}

/**
 * Modal to change the primary student of an individual lesson.
 * Group lessons only show an explanation — composition is edited via the group.
 */
export default function EditLessonStudentsModal({
  lesson,
  students = [],
  contacts = [],
  tutorStudents = [],
  onClose,
  onUpdated,
}) {
  const isGroupLesson = Boolean(
    lesson?.group_id || lesson?.groupId || lesson?.lesson_type === "group",
  );
  const isTutorLesson = Boolean(lesson?.tutor_id || lesson?.tutorId);
  const options = useMemo(
    () =>
      buildOptions({
        students,
        contacts,
        tutorStudents,
        isTutorLesson,
      }),
    [students, contacts, tutorStudents, isTutorLesson],
  );

  const [selectedKey, setSelectedKey] = useState(() =>
    resolveCurrentTargetKey(lesson),
  );
  const [saving, setSaving] = useState(false);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setHistoryLoading(true);
      try {
        const rows = await api.lessons.listStudentChanges(lesson.id);
        if (!cancelled) {
          setHistory(Array.isArray(rows) ? rows : []);
        }
      } catch {
        if (!cancelled) setHistory([]);
      } finally {
        if (!cancelled) setHistoryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [lesson.id]);

  const handleSave = async () => {
    if (isGroupLesson) {
      onClose();
      return;
    }
    const option = options.find((row) => row.key === selectedKey);
    if (!option) {
      toast({
        title: "Выберите ученика",
        variant: "destructive",
      });
      return;
    }
    if (selectedKey === resolveCurrentTargetKey(lesson)) {
      onClose();
      return;
    }

    setSaving(true);
    try {
      const updated = await api.lessons.updateStudents(lesson.id, option.payload);
      toast({ title: "Ученик урока обновлён" });
      onUpdated?.(updated);
      onClose();
    } catch (err) {
      toast({
        title: "Не удалось сменить ученика",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
      <div className="@container bg-white dark:bg-slate-900 rounded-2xl w-full max-w-[min(100%,28rem)] sm:max-w-lg shadow-xl max-h-[min(90vh,100%)] flex flex-col min-w-0 overflow-hidden rounded-b-none sm:rounded-2xl mt-auto sm:mt-0">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Users className="w-4 h-4 text-brand" />
            Изменить учеников
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
          >
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-w-0">
          {isGroupLesson ? (
            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
              Это групповой урок. Состав учеников берётся из группы и здесь не
              меняется. Откройте карточку группы, чтобы добавить или убрать
              участников.
            </p>
          ) : (
            <>
              <div className="min-w-0 space-y-1.5">
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
                  Ученик урока
                </label>
                <select
                  value={selectedKey}
                  onChange={(e) => setSelectedKey(e.target.value)}
                  className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                >
                  <option value="">Выбрать ученика</option>
                  {options.map((option) => (
                    <option key={option.key} value={option.key}>
                      {option.label}
                    </option>
                  ))}
                </select>
                {(lesson.status === "completed" ||
                  lesson.status === "missed_no_notice") && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Урок уже списан: баланс старого ученика вернётся, у нового —
                    спишется 1 занятие.
                  </p>
                )}
              </div>

              <div className="min-w-0 space-y-2">
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                  История смен
                </p>
                {historyLoading ? (
                  <p className="text-xs text-slate-400 inline-flex items-center gap-1.5">
                    <Loader2 className="w-3 h-3 animate-spin" /> Загрузка…
                  </p>
                ) : history.length === 0 ? (
                  <p className="text-xs text-slate-400">Пока без изменений</p>
                ) : (
                  <ul className="space-y-2 max-h-40 overflow-y-auto">
                    {history.slice(0, 8).map((row) => (
                      <li
                        key={row.id}
                        className="text-xs text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-slate-800 rounded-lg px-2.5 py-2"
                      >
                        <span className="font-medium">
                          {row.old_display_name || "—"}
                        </span>
                        {" → "}
                        <span className="font-medium">
                          {row.new_display_name || "—"}
                        </span>
                        <span className="block text-slate-400 mt-0.5">
                          {row.created_at
                            ? new Date(row.created_at).toLocaleString("ru-RU")
                            : ""}
                          {row.balance_restored || row.balance_deducted
                            ? " · баланс пересчитан"
                            : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className={`${actionBtnBase} text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 sm:w-auto sm:min-w-[6.5rem]`}
          >
            {isGroupLesson ? "Закрыть" : "Отмена"}
          </button>
          {!isGroupLesson ? (
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className={`${actionBtnBase} bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-[6.5rem]`}
            >
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Сохранение…
                </span>
              ) : (
                "Сохранить"
              )}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
