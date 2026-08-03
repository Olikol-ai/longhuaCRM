import React, { useState, useEffect } from "react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import TeacherAvailabilityTab from "@/components/schedule/TeacherAvailabilityTab";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/lib/ThemeContext";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";
import { toast } from "@/components/ui/use-toast";
import SchoolScheduleCalendar from "@/components/schedule/SchoolScheduleCalendar";

export default function TeacherSchedule() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [teacher, setTeacher] = useState(null);
  const [allTeachers, setAllTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState("schedule");
  const [loadError, setLoadError] = useState(null);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoadError(null);
    try {
      const [teachers, allLessons, allStudents, allGroups, myContacts] =
        await Promise.all([
          api.teachers.list(),
          api.lessons.list("-date", 500),
          api.students.list(),
          api.groups.list(),
          api.teacherStudentContacts
            .listMine({ ownerType: "teacher" })
            .catch(() => []),
        ]);
      const t = teachers.find(
        (row) => row.user_id === user.id || row.email === user.email,
      );
      setAllTeachers(teachers);
      if (t) {
        setTeacher(t);
        setLessons(allLessons.filter((l) => l.teacher_id === t.id));
        setStudents(allStudents.filter((s) => s.assigned_teacher === t.id));
        setGroups(allGroups.filter((g) => g.teacher_id === t.id));
        setContacts(Array.isArray(myContacts) ? myContacts : []);
      } else {
        setTeacher(null);
        setLessons([]);
        setStudents([]);
        setGroups([]);
        setContacts([]);
      }
    } catch (err) {
      setLoadError(err?.message || "Не удалось загрузить расписание");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLesson = async (data, recurring) => {
    if (!teacher) return;
    try {
      const lessonData = { ...data, teacher_id: teacher.id };
      await createWeeklyLessonSeries(
        (payload) => api.lessons.create(payload),
        lessonData,
        recurring,
        {
          createRecurring: (payload) => api.lessons.createRecurring(payload),
          untilDate: data.recurrence_until || null,
        },
      );
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось создать урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleUpdateLesson = async (id, data) => {
    const attendanceConfirmed = data.status === "completed";
    const wasAbsent = data.completion_attendance === "missed";
    const timeChanged =
      data.date != null || data.start_time != null || data.duration != null;

    try {
      await api.lessons.update(id, data);
      toast({
        title: attendanceConfirmed
          ? wasAbsent
            ? "Отсутствие зафиксировано."
            : "Посещение подтверждено."
          : timeChanged
            ? "Занятие успешно перенесено."
            : "Информация о занятии обновлена.",
      });
      await loadData();
    } catch (err) {
      toast({
        title: attendanceConfirmed
          ? "Не удалось завершить занятие"
          : "Не удалось обновить занятие",
        description:
          err?.message || "Проверьте свободный график и пересечения",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleMarkLesson = async (
    lesson,
    status,
    completionAttendance = "attended",
  ) => {
    try {
      const payload =
        status === "completed"
          ? { status, completion_attendance: completionAttendance }
          : { status };
      await api.lessons.update(lesson.id, payload);
      toast({
        title:
          status === "completed"
            ? completionAttendance === "missed"
              ? "Отсутствие зафиксировано."
              : "Посещение подтверждено."
            : "Статус занятия обновлён.",
      });
      await loadData();
    } catch (err) {
      toast({
        title: "Не удалось обновить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
      throw err;
    }
  };

  const headerExtra = (
    <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
        <button
          type="button"
          onClick={() => setMainTab("schedule")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            mainTab === "schedule"
              ? "bg-white dark:bg-slate-700 text-brand dark:text-brand shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Моё расписание
        </button>
        <button
          type="button"
          onClick={() => setMainTab("availability")}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            mainTab === "availability"
              ? "bg-white dark:bg-slate-700 text-brand dark:text-brand shadow-sm"
              : "text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
          }`}
        >
          Свободный график
        </button>
      </div>
      <button
        type="button"
        onClick={toggleTheme}
        className="p-2.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
        title="Сменить тему"
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
    </div>
  );

  if (mainTab === "availability") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto dark:bg-slate-950 min-h-screen">
        {headerExtra}
        <TeacherAvailabilityTab teacher={teacher} />
      </div>
    );
  }

  return (
    <SchoolScheduleCalendar
      title="Моё расписание"
      role="teacher"
      lessons={lessons}
      teachers={allTeachers.length ? allTeachers : teacher ? [teacher] : []}
      students={students}
      contacts={contacts}
      groups={groups}
      loading={loading}
      error={loadError}
      onRetry={() => {
        setLoading(true);
        loadData();
      }}
      defaultTeacherId={teacher?.id || ""}
      onCreateLesson={handleSaveLesson}
      onUpdateLesson={handleUpdateLesson}
      onMarkLesson={handleMarkLesson}
      onLessonsLocalPatch={(updated) => {
        setLessons((prev) =>
          prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
        );
      }}
      showQuickActions
      createButtonLabel="Создать занятие"
      headerExtra={headerExtra}
    />
  );
}
