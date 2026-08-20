import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "@/api";
import {
  ArrowLeft,
  CalendarRange,
  Loader2,
  Plus,
  Trash2,
  UserPlus,
  Users,
  BookOpen,
  Clock,
} from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { resolveAssignedTeacherLabel } from "@/lib/teacherLabels";
import { resolveStudentLabel } from "@/lib/studentLabels";
import { formatTime } from "@/lib/time-slots";
import {
  localizeEntityStatus,
  localizeLessonStatus,
  localizeSeriesStatus,
} from "@/lib/locale-by";
import LessonDetailModal from "@/components/schedule/LessonDetailModal";
import LessonAttendancePanel from "@/components/groups/LessonAttendancePanel";

const TABS = [
  { id: "overview", label: "Обзор" },
  { id: "students", label: "Ученики" },
  { id: "schedule", label: "Расписание" },
  { id: "lessons", label: "Уроки" },
];

const WEEKDAYS = [
  { value: 0, label: "Понедельник" },
  { value: 1, label: "Вторник" },
  { value: 2, label: "Среда" },
  { value: 3, label: "Четверг" },
  { value: 4, label: "Пятница" },
  { value: 5, label: "Суббота" },
  { value: 6, label: "Воскресенье" },
];

function formatSlot(slot) {
  const day = WEEKDAYS.find((d) => d.value === (slot.day_of_week ?? slot.dayOfWeek));
  const time = formatTime(slot.start_time ?? slot.startTime);
  return `${day?.label ?? "День"} ${time}`;
}

export default function GroupDetail() {
  const { groupId } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [workspace, setWorkspace] = useState(null);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [memberStudentId, setMemberStudentId] = useState("");
  const [viewingLesson, setViewingLesson] = useState(null);
  const [expandedLessonId, setExpandedLessonId] = useState(null);

  const [seriesForm, setSeriesForm] = useState({
    course_id: "",
    start_date: "",
    total_lessons: 35,
    duration: 60,
    slots: [
      { day_of_week: 1, start_time: "18:30" },
      { day_of_week: 3, start_time: "18:30" },
    ],
  });
  const [creatingSeries, setCreatingSeries] = useState(false);

  const load = useCallback(async () => {
    if (!groupId) return;
    setLoading(true);
    try {
      const [ws, t, s, c] = await Promise.all([
        api.groups.workspace(groupId),
        api.teachers.list(),
        api.students.list(),
        api.courses.list(),
      ]);
      setWorkspace(ws);
      setTeachers(t);
      setStudents(s);
      setCourses(c);
      const active = ws?.active_series ?? ws?.activeSeries;
      if (active?.course_id || active?.courseId) {
        setSeriesForm((prev) => ({
          ...prev,
          course_id: active.course_id ?? active.courseId ?? prev.course_id,
          start_date: active.start_date ?? active.startDate ?? prev.start_date,
          total_lessons: active.total_lessons ?? active.totalLessons ?? prev.total_lessons,
          duration: active.duration ?? prev.duration,
          slots: (active.slots ?? []).length
            ? active.slots.map((slot) => ({
                day_of_week: slot.day_of_week ?? slot.dayOfWeek,
                start_time: formatTime(slot.start_time ?? slot.startTime ?? "10:00") || "10:00",
              }))
            : prev.slots,
        }));
      }
    } catch (err) {
      toast({ title: "Не удалось загрузить группу", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  const group = workspace?.group;
  const members = workspace?.members ?? [];
  const lessons = workspace?.lessons ?? [];
  const seriesList = workspace?.series ?? [];
  const activeSeries = workspace?.active_series ?? workspace?.activeSeries;

  const memberStudentIds = useMemo(
    () => new Set(members.map((m) => m.student_id ?? m.studentId).filter(Boolean)),
    [members],
  );

  const availableStudents = useMemo(
    () =>
      students.filter(
        (s) => s.status !== "inactive" && !memberStudentIds.has(s.id),
      ),
    [students, memberStudentIds],
  );

  const handleAddMember = async () => {
    if (!memberStudentId) {
      toast({ title: "Выберите ученика", variant: "destructive" });
      return;
    }
    try {
      await api.groups.addMember(groupId, memberStudentId);
      setMemberStudentId("");
      await load();
      toast({ title: "Ученик добавлен в группу" });
    } catch (err) {
      toast({
        title: "Не удалось добавить ученика",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const handleRemoveMember = async (memberId) => {
    if (!window.confirm("Удалить ученика из группы? Сам ученик останется в системе.")) return;
    try {
      await api.groups.removeMember(groupId, memberId);
      await load();
      toast({ title: "Ученик удалён из группы" });
    } catch (err) {
      toast({
        title: "Не удалось удалить ученика",
        description: err.message,
        variant: "destructive",
      });
    }
  };

  const updateSlot = (index, field, value) => {
    setSeriesForm((prev) => ({
      ...prev,
      slots: prev.slots.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot)),
    }));
  };

  const addSlot = () => {
    setSeriesForm((prev) => ({
      ...prev,
      slots: [...prev.slots, { day_of_week: 1, start_time: "10:00" }],
    }));
  };

  const removeSlot = (index) => {
    setSeriesForm((prev) => ({
      ...prev,
      slots: prev.slots.filter((_, i) => i !== index),
    }));
  };

  const handleCreateSeries = async () => {
    if (!seriesForm.course_id || !seriesForm.start_date || !group?.teacher_id) {
      toast({ title: "Заполните курс, дату начала и назначьте преподавателя группе", variant: "destructive" });
      return;
    }
    if (seriesForm.slots.length === 0) {
      toast({ title: "Добавьте хотя бы один слот расписания", variant: "destructive" });
      return;
    }
    setCreatingSeries(true);
    try {
      const result = await api.lessonSeries.create({
        course_id: seriesForm.course_id,
        group_id: groupId,
        teacher_id: group.teacher_id,
        start_date: seriesForm.start_date,
        total_lessons: seriesForm.total_lessons,
        duration: seriesForm.duration,
        slots: seriesForm.slots,
      });
      toast({
        title: "Расписание создано",
        description: `Сгенерировано уроков: ${result.lessons_created ?? result.lessonsCreated ?? 0}`,
      });
      await load();
      setActiveTab("lessons");
    } catch (err) {
      toast({ title: "Не удалось создать расписание", description: err.message, variant: "destructive" });
    } finally {
      setCreatingSeries(false);
    }
  };

  const handleLessonUpdate = async (id, data) => {
    await api.lessons.update(id, data);
    setViewingLesson(null);
    await load();
  };

  const handleLessonDelete = async (id, applyScope = "this") => {
    await api.lessons.delete(id, { apply_scope: applyScope });
    setViewingLesson(null);
    await load();
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Загрузка группы…
      </div>
    );
  }

  if (!group) {
    return (
      <div className="p-6 space-y-4">
        <p className="text-sm text-red-600">Группа не найдена</p>
        <Link to="/Groups" className="text-sm text-brand hover:underline">← К списку групп</Link>
      </div>
    );
  }

  const courseName = courses.find((c) => c.id === (activeSeries?.course_id ?? activeSeries?.courseId))?.name;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            type="button"
            onClick={() => navigate("/Groups")}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="h-4 w-4" /> К списку групп
          </button>
          <h2 className="text-xl font-bold">{group.name}</h2>
          <p className="text-sm text-muted-foreground">
            {resolveAssignedTeacherLabel(group.teacher_id, teachers)} · {localizeEntityStatus(group.status)}
            {courseName ? ` · ${courseName}` : ""}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border rounded-xl p-4 bg-card space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><BookOpen className="h-4 w-4" /> Основная информация</h3>
            <p className="text-sm"><span className="text-muted-foreground">Преподаватель:</span> {resolveAssignedTeacherLabel(group.teacher_id, teachers)}</p>
            <p className="text-sm"><span className="text-muted-foreground">Курс:</span> {courseName || "—"}</p>
            <p className="text-sm"><span className="text-muted-foreground">Статус:</span> {localizeEntityStatus(group.status)}</p>
            <p className="text-sm"><span className="text-muted-foreground">Учеников:</span> {members.length}</p>
            <p className="text-sm"><span className="text-muted-foreground">Уроков:</span> {lessons.length}</p>
          </div>
          <div className="border rounded-xl p-4 bg-card space-y-2">
            <h3 className="font-semibold flex items-center gap-2"><CalendarRange className="h-4 w-4" /> Расписание курса</h3>
            {activeSeries ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Старт: {activeSeries.start_date ?? activeSeries.startDate} · {activeSeries.total_lessons ?? activeSeries.totalLessons} занятий
                </p>
                <ul className="text-sm space-y-1">
                  {(activeSeries.slots ?? []).map((slot) => (
                    <li key={slot.id ?? `${slot.day_of_week}-${slot.start_time}`} className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-brand" /> {formatSlot(slot)}
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Расписание ещё не задано — перейдите на вкладку «Расписание».</p>
            )}
          </div>
        </div>
      )}

      {activeTab === "students" && (
        <div className="border rounded-xl p-4 bg-card space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" /> Ученики группы
            </h3>
            <p className="text-xs text-muted-foreground">{members.length} в составе</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <select
              className="border rounded-lg px-3 py-2 text-sm flex-1 bg-background border-input"
              value={memberStudentId}
              onChange={(e) => setMemberStudentId(e.target.value)}
            >
              <option value="">Выберите ученика</option>
              {availableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || "Без имени"}
                  {s.email ? ` · ${s.email}` : ""}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddMember}
              disabled={!memberStudentId}
              className="px-3 py-2 bg-primary text-primary-foreground rounded-lg text-sm flex items-center justify-center gap-1 disabled:opacity-60"
            >
              <UserPlus className="h-4 w-4" /> Добавить ученика
            </button>
          </div>

          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              В группе пока нет учеников. Добавьте первого выше.
            </p>
          ) : (
            <>
            <div className="lg:hidden space-y-3">
              {members.map((member) => {
                const student = students.find(
                  (s) => s.id === (member.student_id ?? member.studentId),
                );
                return (
                  <article
                    key={member.id}
                    className="rounded-xl border border-border p-4 space-y-2"
                  >
                    <p className="font-medium break-words">
                      {student?.name
                        || resolveStudentLabel(member.student_id ?? member.studentId, students)}
                    </p>
                    <p className="text-sm text-muted-foreground break-all">{student?.email || '—'}</p>
                    <p className="text-xs text-muted-foreground">{student?.status || '—'}</p>
                    <button
                      type="button"
                      onClick={() => handleRemoveMember(member.id)}
                      className="inline-flex items-center gap-1 px-3 py-2 min-h-touch text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить
                    </button>
                  </article>
                );
              })}
            </div>
            <div className="hidden lg:block overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-sm">
                <thead className="bg-muted text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Имя</th>
                    <th className="px-3 py-2 font-medium">Эл. почта</th>
                    <th className="px-3 py-2 font-medium">Статус</th>
                    <th className="px-3 py-2 font-medium w-24">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {members.map((member) => {
                    const student = students.find(
                      (s) => s.id === (member.student_id ?? member.studentId),
                    );
                    return (
                      <tr key={member.id}>
                        <td className="px-3 py-2 font-medium">
                          {student?.name
                            || resolveStudentLabel(member.student_id ?? member.studentId, students)}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground">
                          {student?.email || "—"}
                        </td>
                        <td className="px-3 py-2">
                          {student?.status || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(member.id)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-md"
                          >
                            <Trash2 className="h-3.5 w-3.5" /> Удалить
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            </>
          )}
        </div>
      )}

      {activeTab === "schedule" && (
        <div className="space-y-4">
          {seriesList.length > 0 && (
            <div className="border rounded-xl p-4 bg-card space-y-2">
              <h3 className="font-semibold">Текущие серии</h3>
              {seriesList.map((series) => (
                <div key={series.id} className="text-sm border border-border rounded-lg p-3">
                  <p className="font-medium">
                    {series.start_date ?? series.startDate} · {series.total_lessons ?? series.totalLessons} уроков · {localizeSeriesStatus(series.status)}
                  </p>
                  <ul className="mt-1 text-muted-foreground space-y-0.5">
                    {(series.slots ?? []).map((slot) => (
                      <li key={slot.id ?? formatSlot(slot)}>{formatSlot(slot)}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="border rounded-xl p-4 bg-card space-y-4">
            <h3 className="font-semibold">Создать расписание курса</h3>
            <div className="grid md:grid-cols-2 gap-3">
              <select
                className="border rounded-lg px-3 py-2 text-sm bg-background border-input"
                value={seriesForm.course_id}
                onChange={(e) => setSeriesForm({ ...seriesForm, course_id: e.target.value })}
              >
                <option value="">Курс</option>
                {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <input
                type="date"
                className="border rounded-lg px-3 py-2 text-sm bg-background border-input"
                value={seriesForm.start_date}
                onChange={(e) => setSeriesForm({ ...seriesForm, start_date: e.target.value })}
              />
              <input
                type="number"
                min={1}
                className="border rounded-lg px-3 py-2 text-sm bg-background border-input"
                placeholder="Всего занятий"
                value={seriesForm.total_lessons}
                onChange={(e) => setSeriesForm({ ...seriesForm, total_lessons: Number(e.target.value) })}
              />
              <input
                type="number"
                min={15}
                step={15}
                className="border rounded-lg px-3 py-2 text-sm bg-background border-input"
                placeholder="Длительность (мин)"
                value={seriesForm.duration}
                onChange={(e) => setSeriesForm({ ...seriesForm, duration: Number(e.target.value) })}
              />
            </div>

            <div className="space-y-2">
              <p className="text-sm font-medium">Слоты ({seriesForm.slots.length} в неделю)</p>
              {seriesForm.slots.map((slot, index) => (
                <div key={index} className="flex flex-wrap gap-2 items-center">
                  <select
                    className="border rounded-lg px-3 py-2 text-sm bg-background border-input"
                    value={slot.day_of_week}
                    onChange={(e) => updateSlot(index, "day_of_week", Number(e.target.value))}
                  >
                    {WEEKDAYS.map((day) => (
                      <option key={day.value} value={day.value}>{day.label}</option>
                    ))}
                  </select>
                  <input
                    type="time"
                    className="border rounded-lg px-3 py-2 text-sm bg-background border-input"
                    value={slot.start_time}
                    onChange={(e) => updateSlot(index, "start_time", e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                    disabled={seriesForm.slots.length <= 1}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={addSlot}
                className="text-sm text-brand hover:underline inline-flex items-center gap-1"
              >
                <Plus className="h-4 w-4" /> Добавить день
              </button>
            </div>

            <button
              type="button"
              onClick={handleCreateSeries}
              disabled={creatingSeries}
              className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm disabled:opacity-60"
            >
              {creatingSeries ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarRange className="h-4 w-4" />}
              Создать уроки по расписанию
            </button>
          </div>
        </div>
      )}

      {activeTab === "lessons" && (
        <div className="border rounded-xl p-4 bg-card space-y-3">
          <h3 className="font-semibold">Уроки группы</h3>
          {lessons.length === 0 ? (
            <p className="text-sm text-muted-foreground">Уроков пока нет. Создайте расписание на вкладке «Расписание».</p>
          ) : (
            lessons.map((lesson) => (
              <div key={lesson.id} className="border border-border rounded-lg overflow-hidden">
                <div className="flex items-center justify-between gap-3 px-3 py-2 bg-muted">
                  <button
                    type="button"
                    onClick={() => setExpandedLessonId(expandedLessonId === lesson.id ? null : lesson.id)}
                    className="text-sm font-medium text-left hover:text-brand"
                  >
                    {lesson.date} · {formatTime(lesson.start_time)} · {localizeLessonStatus(lesson.status)}
                  </button>
                  <button
                    type="button"
                    onClick={() => setViewingLesson(lesson)}
                    className="text-xs px-2 py-1 border rounded-md hover:bg-white dark:hover:bg-slate-900 border-border"
                  >
                    Открыть
                  </button>
                </div>
                {expandedLessonId === lesson.id && (
                  <div className="px-3 py-3 border-t border-border">
                    <LessonAttendancePanel
                      lessonId={lesson.id}
                      students={students}
                      isGroupLesson
                    />
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {viewingLesson && (
        <LessonDetailModal
          lesson={viewingLesson}
          teachers={teachers}
          students={students}
          isAdmin
          isTeacher={false}
          onUpdate={handleLessonUpdate}
          onDelete={handleLessonDelete}
          onClose={() => setViewingLesson(null)}
          showAttendance
        />
      )}
    </div>
  );
}
