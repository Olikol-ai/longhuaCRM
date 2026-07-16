import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { addDays, format, parseISO } from "date-fns";
import { X, RefreshCw } from "lucide-react";
import { api } from "@/api";
import TeacherAvailabilityPanel, { dayIndexFromDate } from "./TeacherAvailabilityPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DROPDOWN_Z = "z-[200]";

export default function LessonModal({
  date,
  teachers,
  students,
  groups = [],
  onSave,
  onClose,
  defaultTeacherId,
}) {
  const [form, setForm] = useState({
    teacher_id: defaultTeacherId || "",
    lesson_type: "individual",
    primary_student_id: "",
    group_id: "",
    date: date || "",
    start_time: "10:00",
    duration: 60,
    meeting_link: "",
    status: "planned",
    lesson_format: "online",
    notes: "",
  });
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [teacherSchedule, setTeacherSchedule] = useState({ hasSchedule: false, slots: [] });

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  useEffect(() => {
    if (!form.teacher_id) {
      setTeacherSchedule({ hasSchedule: false, slots: [] });
      return;
    }

    let cancelled = false;
    setScheduleLoading(true);
    api.schedule.getTeacherAvailability(form.teacher_id)
      .then((data) => {
        if (!cancelled) {
          setTeacherSchedule({
            hasSchedule: Boolean(data?.hasSchedule),
            slots: Array.isArray(data?.slots) ? data.slots : [],
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTeacherSchedule({ hasSchedule: false, slots: [] });
        }
      })
      .finally(() => {
        if (!cancelled) setScheduleLoading(false);
      });

    return () => { cancelled = true; };
  }, [form.teacher_id]);

  const slotsForDay = useMemo(() => {
    if (!form.date || !teacherSchedule.hasSchedule) return [];
    const dayIndex = dayIndexFromDate(form.date);
    return teacherSchedule.slots.filter((slot) => slot.day === dayIndex);
  }, [form.date, teacherSchedule]);

  const activeStudents = students.filter((s) => s.status !== "inactive");
  const activeTeachers = teachers.filter((t) => t.status !== "inactive");
  const teacherGroups = useMemo(
    () => groups.filter((g) => !form.teacher_id || g.teacher_id === form.teacher_id),
    [groups, form.teacher_id],
  );

  const canSubmit = Boolean(
    form.teacher_id &&
    form.date &&
    form.start_time &&
    (form.lesson_type === "group" ? form.group_id : form.primary_student_id),
  );

  const validateTeacherAvailability = async (lessonDate, startTime, duration) => {
    if (!form.teacher_id || !lessonDate || !startTime) return true;
    const result = await api.schedule.checkTeacherAvailability(form.teacher_id, {
      date: lessonDate,
      start_time: startTime,
      duration,
    });
    if (!result?.available) {
      alert(result?.message || "Преподаватель в это время не работает. Урок не может быть назначен.");
      return false;
    }
    return true;
  };

  const handleSave = async () => {
    if (!canSubmit || saving) return;

    if (form.lesson_type === "individual" && !form.primary_student_id) {
      alert("Выберите ученика для индивидуального урока");
      return;
    }
    if (form.lesson_type === "group" && !form.group_id) {
      alert("Выберите группу для группового урока");
      return;
    }

    const lessonDateTime = new Date(`${form.date}T${form.start_time}`);
    const now = new Date();
    const hoursUntilLesson = (lessonDateTime - now) / (1000 * 60 * 60);
    if (hoursUntilLesson < 2) {
      alert("Урок должен быть запланирован не ранее чем за 2 часа до начала");
      return;
    }

    const duration = +form.duration;
    const datesToCheck = recurring
      ? [
          form.date,
          format(addDays(parseISO(form.date), 7), "yyyy-MM-dd"),
        ]
      : [form.date];

    setSaving(true);
    try {
      for (const lessonDate of datesToCheck) {
        const ok = await validateTeacherAvailability(lessonDate, form.start_time, duration);
        if (!ok) return;
      }

      const payload = {
        teacher_id: form.teacher_id,
        date: form.date,
        start_time: form.start_time,
        duration,
        meeting_link: form.meeting_link,
        status: form.status,
        lesson_format: form.lesson_format,
        notes: form.notes,
        lesson_type: form.lesson_type,
        ...(form.lesson_type === "group"
          ? { group_id: form.group_id }
          : { primary_student_id: form.primary_student_id }),
      };

      await onSave(payload, recurring);
    } catch (err) {
      alert(err?.message || "Не удалось создать урок");
    } finally {
      setSaving(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col z-[100]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800">Запланировать урок</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Преподаватель *</label>
              <Select
                value={form.teacher_id}
                onValueChange={(value) => {
                  setForm((f) => ({
                    ...f,
                    teacher_id: value,
                    group_id: "",
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Выбрать преподавателя" />
                </SelectTrigger>
                <SelectContent className={DROPDOWN_Z}>
                  {activeTeachers.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-600 mb-1">Тип урока *</label>
              <Select
                value={form.lesson_type}
                onValueChange={(value) => {
                  setForm((f) => ({
                    ...f,
                    lesson_type: value,
                    primary_student_id: value === "individual" ? f.primary_student_id : "",
                    group_id: value === "group" ? f.group_id : "",
                  }));
                }}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={DROPDOWN_Z}>
                  <SelectItem value="individual">Индивидуальный</SelectItem>
                  <SelectItem value="group">Групповой</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {form.lesson_type === "individual" ? (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ученик *</label>
                <Select
                  value={form.primary_student_id}
                  onValueChange={(value) => set("primary_student_id", value)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выбрать ученика" />
                  </SelectTrigger>
                  <SelectContent className={DROPDOWN_Z}>
                    {activeStudents.length === 0 ? (
                      <SelectItem value="__none" disabled>Нет доступных учеников</SelectItem>
                    ) : (
                      activeStudents.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name} · баланс: {s.lesson_balance || 0}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Группа *</label>
                <Select
                  value={form.group_id}
                  onValueChange={(value) => set("group_id", value)}
                  disabled={!form.teacher_id}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={form.teacher_id ? "Выбрать группу" : "Сначала выберите преподавателя"} />
                  </SelectTrigger>
                  <SelectContent className={DROPDOWN_Z}>
                    {teacherGroups.length === 0 ? (
                      <SelectItem value="__none" disabled>
                        {form.teacher_id ? "Нет групп у преподавателя" : "Сначала выберите преподавателя"}
                      </SelectItem>
                    ) : (
                      teacherGroups.map((g) => (
                        <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Дата *</label>
              <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Время начала *</label>
              <input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
            </div>
            <TeacherAvailabilityPanel
              loading={scheduleLoading}
              hasSchedule={teacherSchedule.hasSchedule}
              slotsForDay={slotsForDay}
              selectedDate={form.date}
            />
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Длительность (мин)</label>
              <Select
                value={String(form.duration)}
                onValueChange={(value) => set("duration", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={DROPDOWN_Z}>
                  {[30, 45, 60, 90, 120].map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} мин</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1">Формат</label>
              <Select
                value={form.lesson_format}
                onValueChange={(value) => set("lesson_format", value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className={DROPDOWN_Z}>
                  <SelectItem value="online">Дистанционное</SelectItem>
                  <SelectItem value="offline">Очное</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {form.lesson_format === "online" && (
              <div className="col-span-2">
                <label className="block text-xs font-medium text-slate-600 mb-1">Ссылка на встречу</label>
                <input value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)}
                  placeholder="https://zoom.us/j/... or meet.google.com/..."
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400" />
              </div>
            )}
          </div>

          <div
            onClick={() => setRecurring(!recurring)}
            className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
              recurring ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:bg-slate-50"
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${recurring ? "text-indigo-600" : "text-slate-400"}`} />
            <div>
              <p className={`text-xs font-semibold ${recurring ? "text-indigo-700" : "text-slate-600"}`}>Еженедельный повтор</p>
              <p className="text-[10px] text-slate-400">Создаёт урок на выбранную дату и ещё один через неделю</p>
            </div>
            <div className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center ${recurring ? "border-indigo-600 bg-indigo-600" : "border-slate-300"}`}>
              {recurring && <span className="text-white text-[8px] font-bold">✓</span>}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 rounded-lg">Отмена</button>
          <button type="button" onClick={handleSave}
            disabled={!canSubmit || saving}
            className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-40">
            {saving ? "Создание..." : recurring ? "Создать 2 урока" : "Создать урок"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
