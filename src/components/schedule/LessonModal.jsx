import { useState, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { addDays, format, parseISO } from "date-fns";
import { X, RefreshCw, Loader2 } from "lucide-react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import TeacherAvailabilityPanel, { dayIndexFromDate } from "./TeacherAvailabilityPanel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const DROPDOWN_Z = "z-[200]";
const AVAILABLE_DEBOUNCE_MS = 400;
const LESSON_CREATE_LEAD_HOURS = 2;
const LESSON_CREATE_LEAD_MESSAGE =
  "Урок должен быть запланирован не ранее чем за 2 часа до начала";

function normalizeAvailableList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.available)) return data.available;
  if (Array.isArray(data?.teachers)) return data.teachers;
  return [];
}

export default function LessonModal({
  date,
  teachers,
  students,
  contacts = [],
  groups = [],
  onSave,
  onClose,
  defaultTeacherId,
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState({
    teacher_id: defaultTeacherId || "",
    lesson_type: "individual",
    student_target_type: "crm",
    primary_student_id: "",
    teacher_student_contact_id: "",
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
  const [availableTeachers, setAvailableTeachers] = useState([]);
  const [availableLoading, setAvailableLoading] = useState(false);
  const [availableError, setAvailableError] = useState(null);
  const availableRequestId = useRef(0);

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
            hasSchedule: Boolean(data?.hasSchedule ?? data?.has_schedule),
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

  useEffect(() => {
    const dateValue = String(form.date || "").trim();
    const startTime = String(form.start_time || "").trim();
    if (!dateValue || !startTime) {
      setAvailableTeachers([]);
      setAvailableError(null);
      setAvailableLoading(false);
      return undefined;
    }

    const requestId = ++availableRequestId.current;
    setAvailableLoading(true);
    setAvailableError(null);

    const timer = setTimeout(() => {
      api.teachers
        .getAvailable({
          date: dateValue,
          start_time: startTime,
          duration: Number(form.duration) || 60,
        })
        .then((data) => {
          if (availableRequestId.current !== requestId) return;
          setAvailableTeachers(normalizeAvailableList(data));
          setAvailableError(null);
        })
        .catch((err) => {
          if (availableRequestId.current !== requestId) return;
          setAvailableTeachers([]);
          setAvailableError(err?.message || "Не удалось загрузить свободных преподавателей");
        })
        .finally(() => {
          if (availableRequestId.current === requestId) {
            setAvailableLoading(false);
          }
        });
    }, AVAILABLE_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
    };
  }, [form.date, form.start_time, form.duration]);

  const slotsForDay = useMemo(() => {
    if (!form.date || !teacherSchedule.hasSchedule) return [];
    const dayIndex = dayIndexFromDate(form.date);
    return teacherSchedule.slots.filter((slot) => slot.day === dayIndex);
  }, [form.date, teacherSchedule]);

  const activeStudents = students.filter((s) => s.status !== "inactive");
  const activeContacts = useMemo(
    () =>
      (Array.isArray(contacts) ? contacts : []).filter((c) => {
        if (c.status === "inactive") return false;
        if (!form.teacher_id) return true;
        const ownerType = c.owner_type || c.ownerType;
        const ownerId = c.owner_id || c.ownerId;
        if (ownerType && ownerType !== "teacher") return false;
        if (ownerId && ownerId !== form.teacher_id) return false;
        return true;
      }),
    [contacts, form.teacher_id],
  );
  const activeTeachers = teachers.filter((t) => t.status !== "inactive");
  const teacherGroups = useMemo(
    () => groups.filter((g) => !form.teacher_id || g.teacher_id === form.teacher_id),
    [groups, form.teacher_id],
  );

  const availableIds = useMemo(
    () => new Set(availableTeachers.map((t) => t.id)),
    [availableTeachers],
  );

  const selectedTeacherBusy = Boolean(
    form.teacher_id
    && form.date
    && form.start_time
    && !availableLoading
    && !availableError
    && !availableIds.has(form.teacher_id),
  );

  const showAvailablePanel = Boolean(form.date && form.start_time);

  const canSubmit = Boolean(
    form.teacher_id &&
    form.date &&
    form.start_time &&
    (form.lesson_type === "group"
      ? form.group_id
      : form.student_target_type === "contact"
        ? form.teacher_student_contact_id
        : form.primary_student_id),
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

    if (form.lesson_type === "individual") {
      if (form.student_target_type === "contact" && !form.teacher_student_contact_id) {
        alert("Выберите личного ученика");
        return;
      }
      if (form.student_target_type !== "contact" && !form.primary_student_id) {
        alert("Выберите ученика для индивидуального урока");
        return;
      }
    }
    if (form.lesson_type === "group" && !form.group_id) {
      alert("Выберите группу для группового урока");
      return;
    }

    const lessonDateTime = new Date(`${form.date}T${form.start_time}`);
    const now = new Date();
    const hoursUntilLesson = (lessonDateTime - now) / (1000 * 60 * 60);
    // Admin may create at any lead time; Teacher/Tutor keep the 2-hour rule.
    // Backend enforces the same rule — this is UX only.
    if (!isAdmin && hoursUntilLesson < LESSON_CREATE_LEAD_HOURS) {
      alert(LESSON_CREATE_LEAD_MESSAGE);
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
          : form.student_target_type === "contact"
            ? { teacher_student_contact_id: form.teacher_student_contact_id }
            : { primary_student_id: form.primary_student_id }),
      };

      await onSave(payload, recurring);
    } catch (err) {
      alert(err?.message || "Не удалось создать урок");
    } finally {
      setSaving(false);
    }
  };

  const availablePanel = showAvailablePanel ? (
    <div className="rounded-xl border border-brand-gold/40 dark:border-brand-gold/30 bg-brand-gold-soft dark:bg-brand-gold-soft/40 p-4 text-sm">
      <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-100 mb-3">Свободные преподаватели</h4>
      {availableLoading ? (
        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 text-xs">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Проверяем расписание…
        </div>
      ) : availableError ? (
        <p className="text-xs text-amber-800">{availableError}</p>
      ) : availableTeachers.length === 0 ? (
        <p className="text-sm text-slate-700 dark:text-slate-200">🔴 Нет свободных преподавателей на выбранное время.</p>
      ) : (
        <ul className="space-y-1.5">
          {availableTeachers.map((t) => (
            <li key={t.id} className="text-sm text-slate-800 dark:text-slate-100">
              🟢 {t.name}
            </li>
          ))}
        </ul>
      )}
      {selectedTeacherBusy && (
        <p className="mt-3 text-xs text-amber-900 border-t border-amber-200/70 pt-3">
          Выбранный преподаватель уже имеет занятие в это время.
        </p>
      )}
      {form.teacher_id && !selectedTeacherBusy && !availableLoading && !availableError && availableIds.has(form.teacher_id) && (
        <p className="mt-3 text-xs text-emerald-800 border-t border-amber-200/70 pt-3">
          🟢 Выбранный преподаватель свободен в это время.
        </p>
      )}
    </div>
  ) : null;

  const modal = (
    <div
      className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md md:max-w-3xl shadow-xl max-h-[90vh] flex flex-col z-[100]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex-shrink-0">
          <h3 className="text-base font-semibold text-slate-800 dark:text-slate-100">Запланировать урок</h3>
          <button type="button" onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg">
            <X className="w-4 h-4 text-slate-500 dark:text-slate-400" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 min-h-0 overscroll-contain">
          <div className="flex flex-col md:flex-row gap-5 md:gap-6">
            <div className="flex-1 min-w-0 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Преподаватель *</label>
                  <Select
                    value={form.teacher_id}
                    onValueChange={(value) => {
                      setForm((f) => ({
                        ...f,
                        teacher_id: value,
                        group_id: "",
                        teacher_student_contact_id: "",
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
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Тип урока *</label>
                  <Select
                    value={form.lesson_type}
                    onValueChange={(value) => {
                      setForm((f) => ({
                        ...f,
                        lesson_type: value,
                        primary_student_id: value === "individual" ? f.primary_student_id : "",
                        teacher_student_contact_id: value === "individual" ? f.teacher_student_contact_id : "",
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
                  <>
                    <div className="col-span-2">
                      <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Тип ученика *</label>
                      <Select
                        value={form.student_target_type}
                        onValueChange={(value) => {
                          setForm((f) => ({
                            ...f,
                            student_target_type: value,
                            primary_student_id: "",
                            teacher_student_contact_id: "",
                          }));
                        }}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className={DROPDOWN_Z}>
                          <SelectItem value="crm">Зарегистрированный ученик CRM</SelectItem>
                          <SelectItem value="contact">Личный ученик преподавателя</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {form.student_target_type === "contact" ? (
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Личный ученик *</label>
                        <Select
                          value={form.teacher_student_contact_id}
                          onValueChange={(value) => set("teacher_student_contact_id", value)}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue placeholder="Выбрать из списка" />
                          </SelectTrigger>
                          <SelectContent className={DROPDOWN_Z}>
                            {activeContacts.length === 0 ? (
                              <SelectItem value="__none" disabled>Нет личных учеников — добавьте в разделе «Ученики»</SelectItem>
                            ) : (
                              activeContacts.map((s) => (
                                <SelectItem key={s.id} value={s.id}>
                                  {s.name} · баланс: {s.lesson_balance ?? s.lessonBalance ?? 0}
                                </SelectItem>
                              ))
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <div className="col-span-2">
                        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Ученик CRM *</label>
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
                    )}
                  </>
                ) : (
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Группа *</label>
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
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Дата *</label>
                  <input type="date" value={form.date} onChange={(e) => set("date", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Время начала *</label>
                  <input type="time" value={form.start_time} onChange={(e) => set("start_time", e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40" />
                </div>
                <TeacherAvailabilityPanel
                  loading={scheduleLoading}
                  hasSchedule={teacherSchedule.hasSchedule}
                  slotsForDay={slotsForDay}
                  selectedDate={form.date}
                />
                <div>
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Длительность (мин)</label>
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
                  <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Формат</label>
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
                    <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">Ссылка на встречу</label>
                    <input value={form.meeting_link} onChange={(e) => set("meeting_link", e.target.value)}
                      placeholder="https://zoom.us/j/... или meet.google.com/..."
                      className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-700 rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-brand/20 focus:border-brand/40" />
                  </div>
                )}
              </div>

              <div
                onClick={() => setRecurring(!recurring)}
                className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                  recurring ? "border-brand/40 bg-brand-soft dark:bg-brand-soft/30" : "border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <RefreshCw className={`w-4 h-4 ${recurring ? "text-brand" : "text-slate-400 dark:text-slate-500"}`} />
                <div>
                  <p className={`text-xs font-semibold ${recurring ? "text-brand dark:text-brand" : "text-slate-600 dark:text-slate-300"}`}>Еженедельный повтор</p>
                  <p className="text-[10px] text-slate-400 dark:text-slate-500">Создаёт урок на выбранную дату и ещё один через неделю</p>
                </div>
                <div className={`ml-auto w-4 h-4 rounded border-2 flex items-center justify-center ${recurring ? "border-brand bg-brand" : "border-slate-300 dark:border-slate-600"}`}>
                  {recurring && <span className="text-white text-[8px] font-bold">✓</span>}
                </div>
              </div>

              {/* Mobile: panel under the form */}
              <div className="md:hidden">
                {availablePanel}
              </div>
            </div>

            {/* Desktop: side panel */}
            <div className="hidden md:block w-64 shrink-0">
              {availablePanel || (
                <div className="rounded-xl border border-dashed border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-xs text-slate-400 dark:text-slate-500">
                  Выберите дату и время, чтобы увидеть свободных преподавателей.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-100 dark:border-slate-800 flex-shrink-0">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg">Отмена</button>
          <button type="button" onClick={handleSave}
            disabled={!canSubmit || saving}
            className="px-4 py-2 text-sm font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40">
            {saving ? "Создание..." : recurring ? "Создать 2 урока" : "Создать урок"}
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
