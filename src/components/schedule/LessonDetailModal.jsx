import { useState } from "react";
import { X, Edit2, Trash2, CheckCircle2, XCircle, Video, Clock, Calendar, RefreshCw, Users, Loader2, MapPin } from "lucide-react";
import { resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { resolveLessonStudentNames } from "@/lib/studentLabels";
import LessonAttendancePanel from "@/components/groups/LessonAttendancePanel";
import EditLessonStudentsModal from "@/components/schedule/EditLessonStudentsModal";
import RecurrenceApplyScopeDialog from "@/components/schedule/RecurrenceApplyScopeDialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const STATUS_LABELS = {
  planned: "Запланировано",
  completed: "Проведено",
  cancelled: "Отменено",
  rescheduled: "Перенесено",
  missed: "Пропущено",
  missed_no_notice: "Пропущено без предупреждения",
};

const FORMAT_LABELS = { online: "Дистанционное", offline: "Очное" };

const statusColors = {
  planned: "bg-brand-muted text-brand dark:bg-brand/20 dark:text-brand",
  completed: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-500 dark:bg-red-950/50 dark:text-red-400",
  rescheduled: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400",
  missed: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-400",
  missed_no_notice: "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300",
};

const fieldLabelClass =
  "text-[11px] font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500";
const fieldValueClass =
  "text-sm font-medium text-slate-800 dark:text-slate-100 break-words [overflow-wrap:anywhere]";
const actionBtnBase =
  "inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors text-center whitespace-normal leading-snug";

function DetailField({ label, children, icon: Icon }) {
  return (
    <div className="min-w-0 space-y-1">
      <p className={`${fieldLabelClass} flex items-center gap-1`}>
        {Icon ? <Icon className="h-3 w-3 shrink-0" /> : null}
        {label}
      </p>
      <div className={fieldValueClass}>{children}</div>
    </div>
  );
}

function lessonBelongsToSeries(lesson) {
  return Boolean(
    lesson?.recurrence_series_id ||
      lesson?.recurrenceSeriesId ||
      lesson?.is_recurring ||
      lesson?.isRecurring,
  );
}

function seriesUntilFromLesson(lesson) {
  const series = lesson?.recurrence_series || lesson?.recurrenceSeries || null;
  const raw =
    series?.until_date ||
    series?.untilDate ||
    lesson?.recurrence_until ||
    "";
  return raw ? String(raw).slice(0, 10) : "";
}

export default function LessonDetailModal({
  lesson,
  teachers,
  students,
  contacts = [],
  tutorStudents = [],
  isAdmin,
  isTeacher,
  isTutor = false,
  onUpdate,
  onDelete,
  onClose,
  onStudentsUpdated,
  showAttendance = false,
}) {
  const initialInSeries = lessonBelongsToSeries(lesson);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...lesson });
  const [recurring, setRecurring] = useState(initialInSeries);
  const [recurrenceUntil, setRecurrenceUntil] = useState(seriesUntilFromLesson(lesson));
  const [confirmAttendance, setConfirmAttendance] = useState(null);
  const [attendanceBusy, setAttendanceBusy] = useState(false);
  const [editingStudents, setEditingStudents] = useState(false);
  const [scopeDialogOpen, setScopeDialogOpen] = useState(false);
  const [applyScope, setApplyScope] = useState("this");
  const [pendingPayload, setPendingPayload] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const isGroupLesson = Boolean(form.group_id || lesson.group_id || lesson.lesson_type === "group");
  const canMarkAttendance =
    Boolean(isTeacher) && !isAdmin && lesson.status === "planned" && isGroupLesson;
  const showAdminStatusActions =
    Boolean(isAdmin) && lesson.status === "planned";
  const canChangeStudents = Boolean(isAdmin || isTeacher || isTutor);
  const wasInSeries = lessonBelongsToSeries(lesson);

  const buildUpdatePayload = () => {
    const primaryStudentId =
      form.primary_student_id || form.student_id || "";

    const base =
      isTeacher && !isAdmin
        ? {
            date: form.date,
            start_time: form.start_time,
            duration: form.duration,
            room: form.room,
            meeting_link: form.meeting_link,
            notes: form.notes,
          }
        : {
            teacher_id: form.teacher_id,
            date: form.date,
            start_time: form.start_time,
            duration: form.duration,
            status: form.status,
            lesson_format: form.lesson_format,
            room: form.room,
            meeting_link: form.meeting_link,
            notes: form.notes,
            lesson_type: isGroupLesson ? "group" : "individual",
            ...(isGroupLesson
              ? { group_id: form.group_id || lesson.group_id }
              : { primary_student_id: primaryStudentId }),
          };

    return {
      ...base,
      recurrence_weekly: recurring,
      recurrence_until: recurring ? recurrenceUntil || null : null,
    };
  };

  const needsScopePrompt = (payload) => {
    if (wasInSeries) return true;
    if (!wasInSeries && payload.recurrence_weekly) return false;
    return false;
  };

  const handleSave = () => {
    const primaryStudentId =
      form.primary_student_id || form.student_id || "";
    if (!isGroupLesson && !primaryStudentId && isAdmin) {
      alert("Выберите ученика для индивидуального урока");
      return;
    }

    const payload = buildUpdatePayload();
    if (needsScopePrompt(payload)) {
      setPendingPayload(payload);
      setApplyScope("this");
      setScopeDialogOpen(true);
      return;
    }

    void submitUpdate(payload);
  };

  const submitUpdate = async (payload, scope) => {
    setSaving(true);
    try {
      const body = { ...payload };
      if (scope) {
        body.apply_scope = scope;
      } else if (wasInSeries) {
        body.apply_scope = "this";
      }
      await onUpdate(lesson.id, body);
      setEditing(false);
      setScopeDialogOpen(false);
      setPendingPayload(null);
    } catch {
      // Parent shows error toast / alert
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmAttendance = async () => {
    if (!confirmAttendance) return;
    setAttendanceBusy(true);
    try {
      await onUpdate(lesson.id, {
        status: "completed",
        completion_attendance: confirmAttendance,
      });
      setConfirmAttendance(null);
    } catch {
      // Parent shows toast; keep confirmation open for retry.
    } finally {
      setAttendanceBusy(false);
    }
  };

  const displayStudentNames = resolveLessonStudentNames(lesson, students);

  const currentStudentId =
    form.primary_student_id || form.student_id || lesson.primary_student_id || lesson.student_id || "";

  const shellClass =
    "@container bg-white dark:bg-slate-900 rounded-2xl w-full max-w-[min(100%,28rem)] sm:max-w-lg shadow-xl max-h-[min(90vh,100%)] flex flex-col min-w-0 overflow-hidden";

  const openEditing = () => {
    setForm({ ...lesson });
    setRecurring(lessonBelongsToSeries(lesson));
    setRecurrenceUntil(seriesUntilFromLesson(lesson));
    setEditing(true);
  };

  if (editing) {
    return (
      <>
        <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
          <div className={`${shellClass} rounded-b-none sm:rounded-2xl mt-auto sm:mt-0`}>
            <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 min-w-0">
              <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100 min-w-0 break-words">
                {isTeacher && !isAdmin ? "Изменить занятие" : "Редактировать урок"}
              </h3>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="p-1.5 shrink-0 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"
              >
                <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              </button>
            </div>
            <div className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1 min-w-0 overscroll-contain">
              <div className="grid grid-cols-1 gap-4 min-w-0">
                {isAdmin && (
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Преподаватель</label>
                    <select
                      value={form.teacher_id}
                      onChange={(e) => set("teacher_id", e.target.value)}
                      className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                    >
                      {teachers.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {isAdmin && (
                  <div className="min-w-0">
                    {isGroupLesson ? (
                      <>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Группа</label>
                        <p className="text-sm text-slate-700 dark:text-slate-200 px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-slate-50 dark:bg-slate-800/60 break-words [overflow-wrap:anywhere]">
                          Групповой урок — состав учеников берётся из группы
                        </p>
                      </>
                    ) : (
                      <>
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Ученик *</label>
                        <select
                          value={currentStudentId}
                          onChange={(e) => set("primary_student_id", e.target.value)}
                          className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                        >
                          <option value="">Выбрать ученика</option>
                          {students.filter((s) => s.status !== "inactive").map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      </>
                    )}
                  </div>
                )}
                <div className="grid grid-cols-1 @[22rem]:grid-cols-2 gap-4 min-w-0">
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Дата</label>
                    <input
                      type="date"
                      value={form.date}
                      onChange={(e) => set("date", e.target.value)}
                      className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Время начала</label>
                    <input
                      type="time"
                      value={String(form.start_time || "").slice(0, 5)}
                      onChange={(e) => set("start_time", e.target.value)}
                      className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                    />
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Длительность (мин)</label>
                    <select
                      value={form.duration}
                      onChange={(e) => set("duration", +e.target.value)}
                      className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                    >
                      {[30, 45, 60, 90, 120].map((d) => (
                        <option key={d} value={d}>{d} мин</option>
                      ))}
                    </select>
                  </div>
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Кабинет</label>
                    <input
                      value={form.room || ""}
                      onChange={(e) => set("room", e.target.value)}
                      placeholder="Например, 204"
                      className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                    />
                  </div>
                  {isAdmin && (
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Статус</label>
                      <select
                        value={form.status}
                        onChange={(e) => set("status", e.target.value)}
                        className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                      >
                        {Object.entries(STATUS_LABELS).map(([v, l]) => (
                          <option key={v} value={v}>{l}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  {isAdmin && (
                    <div className="min-w-0">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Формат</label>
                      <select
                        value={form.lesson_format || "online"}
                        onChange={(e) => set("lesson_format", e.target.value)}
                        className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                      >
                        <option value="online">Дистанционное</option>
                        <option value="offline">Очное</option>
                      </select>
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Ссылка на онлайн-занятие</label>
                  <input
                    value={form.meeting_link || ""}
                    onChange={(e) => set("meeting_link", e.target.value)}
                    placeholder="Ссылка на Zoom, Google Meet или Teams"
                    className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                  />
                </div>
                <div className="min-w-0">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Комментарий</label>
                  <textarea
                    value={form.notes || ""}
                    onChange={(e) => set("notes", e.target.value)}
                    rows={3}
                    className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40 resize-y"
                  />
                </div>

                <div
                  onClick={() => setRecurring(!recurring)}
                  className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                    recurring
                      ? "border-brand/40 bg-brand-soft dark:bg-brand-soft/30"
                      : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                  }`}
                >
                  <RefreshCw className={`w-4 h-4 ${recurring ? "text-brand" : "text-slate-400 dark:text-slate-500"}`} />
                  <div className="min-w-0">
                    <p className={`text-xs font-semibold ${recurring ? "text-brand" : "text-slate-600 dark:text-slate-300"}`}>
                      Повторять каждую неделю
                    </p>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500">
                      {wasInSeries
                        ? "Урок относится к еженедельной серии"
                        : "Создать еженедельную серию от этого урока"}
                    </p>
                  </div>
                  <div
                    className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center ${
                      recurring ? "border-brand bg-brand" : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {recurring ? <span className="text-white text-[8px] font-bold">✓</span> : null}
                  </div>
                </div>

                {recurring ? (
                  <div className="min-w-0">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                      Дата окончания серии (необязательно)
                    </label>
                    <input
                      type="date"
                      value={recurrenceUntil}
                      min={form.date || undefined}
                      onChange={(e) => setRecurrenceUntil(e.target.value)}
                      className="w-full min-w-0 px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40"
                    />
                  </div>
                ) : null}
              </div>
            </div>
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-4 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
              <button
                type="button"
                onClick={() => setEditing(false)}
                className={`${actionBtnBase} text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 sm:w-auto sm:min-w-[6.5rem]`}
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className={`${actionBtnBase} bg-primary text-primary-foreground hover:bg-primary/90 sm:w-auto sm:min-w-[6.5rem] disabled:opacity-40`}
              >
                {saving ? "Сохранение..." : "Сохранить"}
              </button>
            </div>
          </div>
        </div>

        <RecurrenceApplyScopeDialog
          open={scopeDialogOpen}
          value={applyScope}
          onChange={setApplyScope}
          onCancel={() => {
            setScopeDialogOpen(false);
            setPendingPayload(null);
          }}
          onConfirm={() => {
            if (!pendingPayload) return;
            void submitUpdate(pendingPayload, applyScope);
          }}
        />
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 overflow-y-auto">
        <div className={`${shellClass} rounded-b-none sm:rounded-2xl mt-auto sm:mt-0`} role="dialog" aria-modal="true">
          <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0 min-w-0">
            <div className="flex flex-wrap items-center gap-2 min-w-0 flex-1">
              <span
                className={`text-xs font-bold uppercase px-2.5 py-1 rounded-lg max-w-full break-words ${statusColors[lesson.status] || statusColors.planned}`}
              >
                {STATUS_LABELS[lesson.status] || lesson.status}
              </span>
              <span
                className={`text-xs font-medium px-2.5 py-1 rounded-lg max-w-full break-words ${
                  lesson.lesson_format === "offline"
                    ? "bg-orange-50 text-orange-700 dark:bg-orange-950/40 dark:text-orange-400"
                    : "bg-brand-soft text-brand"
                }`}
              >
                {FORMAT_LABELS[lesson.lesson_format] || "Дистанционное"}
              </span>
            </div>
            <div className="flex gap-1 shrink-0 ml-auto">
              {(isAdmin || (isTeacher && lesson.status === "planned")) && (
                <button
                  type="button"
                  onClick={openEditing}
                  className="p-2 hover:bg-brand-soft hover:text-brand text-slate-400 dark:text-slate-500 rounded-lg"
                  title="Перенести / изменить"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => onDelete(lesson.id)}
                  className="p-2 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950/40 text-slate-400 dark:text-slate-500 rounded-lg"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 dark:text-slate-500 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-w-0 overscroll-contain">
            <section className="grid grid-cols-1 gap-3 min-w-0 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 sm:p-4">
              <DetailField label="Дата" icon={Calendar}>
                {lesson.date}
              </DetailField>
              <DetailField label="Время" icon={Clock}>
                {String(lesson.start_time || "").slice(0, 5)} · {lesson.duration || 60} мин
              </DetailField>
              <DetailField label="Статус">
                {STATUS_LABELS[lesson.status] || lesson.status}
              </DetailField>
            </section>

            <section className="grid grid-cols-1 gap-3 min-w-0 rounded-xl border border-slate-100 dark:border-slate-800 p-3 sm:p-4">
              <DetailField label="Преподаватель">
                {resolveLessonTeacherLabel(lesson, teachers)}
              </DetailField>
              <DetailField label={`Ученики (${displayStudentNames.length})`} icon={Users}>
                {displayStudentNames.length > 0 ? (
                  <ul className="space-y-1.5 list-none m-0 p-0">
                    {displayStudentNames.map((name, i) => (
                      <li key={i} className="break-words [overflow-wrap:anywhere]">
                        {name}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <span className="text-slate-400 dark:text-slate-500 font-normal">—</span>
                )}
              </DetailField>
              {canChangeStudents ? (
                <button
                  type="button"
                  onClick={() => setEditingStudents(true)}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
                >
                  <Users className="w-3.5 h-3.5" />
                  Изменить учеников
                </button>
              ) : null}
              {lesson.room ? (
                <DetailField label="Кабинет" icon={MapPin}>
                  {lesson.room}
                </DetailField>
              ) : null}
            </section>

            {(lesson.lesson_format === "online" || lesson.video_room_url || lesson.meeting_link) ? (
              <a
                href={`/lesson/${lesson.id}/video`}
                className="flex items-start gap-2 px-3 py-2.5 bg-brand-soft text-brand rounded-xl text-sm font-medium hover:bg-brand-muted transition-colors min-w-0"
              >
                <Video className="w-4 h-4 shrink-0 mt-0.5" />
                <span className="min-w-0 break-all [overflow-wrap:anywhere]">
                  {lesson.status === "completed"
                    ? "Открыть видеоурок"
                    : isTeacher || isAdmin
                      ? "Начать видеоурок"
                      : "Войти в видеоурок"}
                </span>
              </a>
            ) : null}

            {lesson.notes ? (
              <section className="min-w-0 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-3 sm:p-4">
                <DetailField label="Комментарий">
                  <p className="whitespace-pre-wrap break-words [overflow-wrap:anywhere] font-normal text-slate-700 dark:text-slate-200">
                    {lesson.notes}
                  </p>
                </DetailField>
              </section>
            ) : null}

            {wasInSeries ? (
              <div className="flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 rounded-lg px-3 py-2 min-w-0">
                <RefreshCw className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                <span className="break-words [overflow-wrap:anywhere]">
                  Повторяющийся урок (каждую неделю)
                  {seriesUntilFromLesson(lesson)
                    ? ` · до ${seriesUntilFromLesson(lesson)}`
                    : " · без даты окончания"}
                </span>
              </div>
            ) : null}

            {showAttendance ? (
              <section className="min-w-0 border-t border-slate-100 dark:border-slate-800 pt-4">
                <LessonAttendancePanel
                  lessonId={lesson.id}
                  students={students}
                  isAdmin={Boolean(isAdmin)}
                  isGroupLesson={isGroupLesson}
                />
              </section>
            ) : null}
          </div>

          {canMarkAttendance ? (
            <div className="flex flex-col gap-2 px-4 sm:px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 min-w-0">
              <div className="flex flex-col gap-2 @[26rem]:flex-row @[26rem]:flex-wrap">
                <button
                  type="button"
                  onClick={() => setConfirmAttendance("attended")}
                  className={`${actionBtnBase} @[26rem]:flex-1 @[26rem]:min-w-[11rem] bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Ученик присутствовал</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmAttendance("missed")}
                  className={`${actionBtnBase} @[26rem]:flex-1 @[26rem]:min-w-[11rem] bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:hover:bg-orange-950/70`}
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Ученик отсутствовал</span>
                </button>
              </div>
              <button
                type="button"
                onClick={() => onUpdate(lesson.id, { status: "cancelled" })}
                className={`${actionBtnBase} bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70`}
              >
                <XCircle className="w-4 h-4 shrink-0" />
                <span>Отменить урок</span>
              </button>
            </div>
          ) : null}

          {showAdminStatusActions ? (
            <div className="flex flex-col gap-2 px-4 sm:px-5 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0 min-w-0">
              <div className="flex flex-col gap-2 @[26rem]:flex-row @[26rem]:flex-wrap">
                <button
                  type="button"
                  onClick={() => onUpdate(lesson.id, { status: "completed" })}
                  className={`${actionBtnBase} @[26rem]:flex-1 @[26rem]:min-w-[8.5rem] bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-400 dark:hover:bg-emerald-950/70`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Проведено</span>
                </button>
                <button
                  type="button"
                  onClick={() => onUpdate(lesson.id, { status: "cancelled" })}
                  className={`${actionBtnBase} @[26rem]:flex-1 @[26rem]:min-w-[8.5rem] bg-red-50 text-red-500 hover:bg-red-100 dark:bg-red-950/40 dark:text-red-400 dark:hover:bg-red-950/70`}
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Отменить</span>
                </button>
                {isGroupLesson ? (
                  <button
                    type="button"
                    onClick={() => onUpdate(lesson.id, { status: "missed" })}
                    className={`${actionBtnBase} @[26rem]:flex-1 @[26rem]:min-w-[8.5rem] bg-orange-50 text-orange-600 hover:bg-orange-100 dark:bg-orange-950/40 dark:text-orange-400 dark:hover:bg-orange-950/70`}
                  >
                    <XCircle className="w-4 h-4 shrink-0" />
                    <span>Пропущено</span>
                  </button>
                ) : null}
              </div>
              {isGroupLesson ? (
                <button
                  type="button"
                  onClick={() => onUpdate(lesson.id, { status: "missed_no_notice" })}
                  className={`${actionBtnBase} bg-red-50 text-red-700 hover:bg-red-100 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900 dark:hover:bg-red-950/70`}
                >
                  <XCircle className="w-4 h-4 shrink-0" />
                  <span>Пропущено без предупреждения</span>
                </button>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

      <AlertDialog
        open={Boolean(confirmAttendance)}
        onOpenChange={(open) => !attendanceBusy && !open && setConfirmAttendance(null)}
      >
        <AlertDialogContent className="max-w-[min(100%,24rem)] mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="break-words [overflow-wrap:anywhere]">
              {confirmAttendance === "missed"
                ? "Подтвердить, что ученик отсутствовал?"
                : "Подтвердить посещение занятия?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              После подтверждения изменить отметку будет нельзя.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row gap-2">
            <AlertDialogCancel disabled={attendanceBusy} className="w-full sm:w-auto">
              Отмена
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={attendanceBusy}
              onClick={(e) => {
                e.preventDefault();
                handleConfirmAttendance();
              }}
              className={
                confirmAttendance === "missed"
                  ? "w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
                  : "w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700"
              }
            >
              {attendanceBusy ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" /> Сохранение…
                </span>
              ) : (
                "Подтвердить"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {editingStudents ? (
        <EditLessonStudentsModal
          lesson={lesson}
          students={students}
          contacts={contacts}
          tutorStudents={tutorStudents}
          onClose={() => setEditingStudents(false)}
          onUpdated={(updated) => {
            onStudentsUpdated?.(updated);
          }}
        />
      ) : null}
    </>
  );
}
