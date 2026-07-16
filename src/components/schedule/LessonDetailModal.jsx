import { useState } from "react";
import { X, Edit2, Trash2, CheckCircle2, XCircle, Video, Clock, Calendar, RefreshCw, Users } from "lucide-react";
import { resolveLessonTeacherLabel } from "@/lib/teacherLabels";
import { resolveLessonStudentNames } from "@/lib/studentLabels";
import LessonAttendancePanel from "@/components/groups/LessonAttendancePanel";

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
  planned: "bg-sky-100 text-sky-700",
  completed: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-500",
  rescheduled: "bg-amber-100 text-amber-700",
  missed: "bg-orange-100 text-orange-700",
  missed_no_notice: "bg-red-100 text-red-700",
};

export default function LessonDetailModal({ lesson, teachers, students, isAdmin, isTeacher, onUpdate, onDelete, onClose, showAttendance = false }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ ...lesson });

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const isGroupLesson = Boolean(form.group_id || lesson.group_id || lesson.lesson_type === "group");

  const handleSave = () => {
    const primaryStudentId =
      form.primary_student_id || form.student_id || "";
    if (!isGroupLesson && !primaryStudentId) {
      alert("Выберите ученика для индивидуального урока");
      return;
    }
    onUpdate(lesson.id, {
      teacher_id: form.teacher_id,
      date: form.date,
      start_time: form.start_time,
      duration: form.duration,
      status: form.status,
      lesson_format: form.lesson_format,
      meeting_link: form.meeting_link,
      notes: form.notes,
      lesson_type: isGroupLesson ? "group" : "individual",
      ...(isGroupLesson
        ? { group_id: form.group_id || lesson.group_id }
        : { primary_student_id: primaryStudentId }),
    });
  };

  const displayStudentNames = resolveLessonStudentNames(lesson, students);

  const currentStudentId =
    form.primary_student_id || form.student_id || lesson.primary_student_id || lesson.student_id || "";

  if (editing) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
          <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
            <h3 className="text-base font-semibold text-slate-800">Редактировать урок</h3>
            <button onClick={() => setEditing(false)} className="p-1.5 hover:bg-slate-100 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
          <div className="p-6 space-y-4 overflow-y-auto flex-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Преподаватель</label>
                <select value={form.teacher_id} onChange={e => set("teacher_id", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                {isGroupLesson ? (
                  <>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Группа</label>
                    <p className="text-sm text-slate-700 px-3 py-2 border border-slate-200 rounded-lg bg-slate-50">
                      Групповой урок — состав учеников берётся из группы
                    </p>
                  </>
                ) : (
                  <>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Ученик *</label>
                    <select
                      value={currentStudentId}
                      onChange={(e) => set("primary_student_id", e.target.value)}
                      className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400"
                    >
                      <option value="">Выбрать ученика</option>
                      {students.filter((s) => s.status !== "inactive").map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Дата</label>
                <input type="date" value={form.date} onChange={e => set("date", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Время начала</label>
                <input type="time" value={form.start_time} onChange={e => set("start_time", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Длительность (мин)</label>
                <select value={form.duration} onChange={e => set("duration", +e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  {[30, 45, 60, 90, 120].map(d => <option key={d} value={d}>{d} мин</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Статус</label>
                <select value={form.status} onChange={e => set("status", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Формат</label>
                <select value={form.lesson_format || "online"} onChange={e => set("lesson_format", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400">
                  <option value="online">Дистанционное</option>
                  <option value="offline">Очное</option>
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ссылка на встречу</label>
                <input value={form.meeting_link || ""} onChange={e => set("meeting_link", e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
            <button onClick={() => setEditing(false)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Отмена</button>
            <button onClick={handleSave} className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700">Сохранить</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-bold uppercase px-2 py-1 rounded-lg ${statusColors[lesson.status] || statusColors.planned}`}>
              {STATUS_LABELS[lesson.status] || lesson.status}
            </span>
            <span className={`text-xs font-medium px-2 py-1 rounded-lg ${lesson.lesson_format === "offline" ? "bg-orange-50 text-orange-700" : "bg-blue-50 text-blue-700"}`}>
              {FORMAT_LABELS[lesson.lesson_format] || "Дистанционное"}
            </span>
          </div>
          <div className="flex gap-1">
            {isAdmin && (
              <>
                <button onClick={() => setEditing(true)} className="p-1.5 hover:bg-indigo-50 hover:text-indigo-600 text-slate-400 rounded-lg">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => onDelete(lesson.id)} className="p-1.5 hover:bg-red-50 hover:text-red-500 text-slate-400 rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </button>
              </>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 text-slate-400 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-700">{lesson.date}</span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-slate-400" />
            <span className="text-sm text-slate-600">{lesson.start_time} · {lesson.duration || 60} мин</span>
          </div>
          <div className="bg-slate-50 rounded-xl p-3 space-y-2">
            <div>
              <p className="text-[10px] text-slate-400 font-medium">Преподаватель</p>
              <p className="text-sm font-medium text-slate-700">{resolveLessonTeacherLabel(lesson, teachers)}</p>
            </div>
            <div>
              <p className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                <Users className="w-3 h-3" /> Ученики ({displayStudentNames.length})
              </p>
              {displayStudentNames.length > 0 ? (
                <div className="space-y-0.5 mt-0.5">
                  {displayStudentNames.map((name, i) => (
                    <p key={i} className="text-sm font-medium text-slate-700">• {name}</p>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-400">—</p>
              )}
            </div>
          </div>
          {lesson.meeting_link && (
            <a href={lesson.meeting_link} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-sm font-medium hover:bg-indigo-100 transition-colors">
              <Video className="w-4 h-4" /> Войти на встречу
            </a>
          )}
          {lesson.is_recurring && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
              <RefreshCw className="w-3 h-3" /> Повторяющийся урок
            </div>
          )}
          {showAttendance && (
            <LessonAttendancePanel lessonId={lesson.id} students={students} />
          )}
        </div>

        {((isAdmin || isTeacher) && lesson.status === "planned") && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 px-5 pb-5">
            <button
              onClick={() => onUpdate(lesson.id, { status: "completed" })}
              className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" /> Проведено
            </button>
            <button
              onClick={() => onUpdate(lesson.id, { status: "cancelled" })}
              className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-red-50 text-red-500 hover:bg-red-100 rounded-xl transition-colors"
            >
              <XCircle className="w-4 h-4" /> Отменить
            </button>
            <button
              onClick={() => onUpdate(lesson.id, { status: "missed" })}
              className="flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-orange-50 text-orange-600 hover:bg-orange-100 rounded-xl transition-colors"
            >
              <XCircle className="w-4 h-4" /> Пропущено
            </button>
            <button
              onClick={() => onUpdate(lesson.id, { status: "missed_no_notice" })}
              className="col-span-2 flex items-center justify-center gap-1.5 py-2 text-sm font-medium bg-red-50 text-red-700 hover:bg-red-100 rounded-xl transition-colors border border-red-200"
            >
              <XCircle className="w-4 h-4" /> Пропущено без предупреждения
            </button>
          </div>
        )}
      </div>
    </div>
  );
}