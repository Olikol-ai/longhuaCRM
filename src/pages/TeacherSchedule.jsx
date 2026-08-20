import React, { useState, useEffect } from "react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import TeacherAvailabilityTab from "@/components/schedule/TeacherAvailabilityTab";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";
import { toast } from "@/components/ui/use-toast";
import SchoolScheduleCalendar from "@/components/schedule/SchoolScheduleCalendar";
import { OfflineSnapshotBanner } from "@/components/pwa/OfflineSnapshotBanner";
import { OFFLINE_RESOURCES, readWithOfflineFallback } from "@/lib/offline";

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
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    setLoadError(null);
    if (!user?.id) return;
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'teacher',
        resource: OFFLINE_RESOURCES.SCHEDULE,
        resourceKey: 'teacher',
        fetcher: async () => {
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
          return {
            allTeachers: teachers,
            teacher: t || null,
            lessons: t ? allLessons.filter((l) => l.teacher_id === t.id) : [],
            students: t ? allStudents.filter((s) => s.assigned_teacher === t.id) : [],
            groups: t ? allGroups.filter((g) => g.teacher_id === t.id) : [],
            contacts: Array.isArray(myContacts) ? myContacts : [],
          };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      if (result.missing || !result.data) {
        setLoadError("Расписание пока недоступно без подключения");
        setTeacher(null);
        setLessons([]);
        setStudents([]);
        setGroups([]);
        setContacts([]);
        setAllTeachers([]);
        return;
      }
      const payload = result.data;
      setAllTeachers(payload.allTeachers || []);
      setTeacher(payload.teacher || null);
      setLessons(payload.lessons || []);
      setStudents(payload.students || []);
      setGroups(payload.groups || []);
      setContacts(payload.contacts || []);
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
    const cancelled = data.status === "cancelled";
    const series =
      data?.apply_scope === "all" ||
      data?.apply_scope === "series" ||
      data?.applyScope === "all" ||
      data?.applyScope === "series";

    try {
      await api.lessons.update(id, data);
      toast({
        title: cancelled
          ? series
            ? "Занятия серии отменены"
            : "Урок отменён"
          : attendanceConfirmed
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
        title: cancelled
          ? "Не удалось отменить урок"
          : attendanceConfirmed
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
    applyScope = "this",
  ) => {
    try {
      const payload =
        status === "completed"
          ? { status, completion_attendance: completionAttendance }
          : { status };
      if (applyScope && applyScope !== "this") {
        payload.apply_scope = applyScope;
      }
      await api.lessons.update(lesson.id, payload);
      const series = applyScope === "all" || applyScope === "series";
      toast({
        title:
          status === "completed"
            ? completionAttendance === "missed"
              ? "Отсутствие зафиксировано."
              : "Посещение подтверждено."
            : status === "cancelled"
              ? series
                ? "Занятия серии отменены"
                : "Урок отменён"
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

  const handleDeleteLesson = async (id, applyScope = "this") => {
    try {
      await api.lessons.delete(id, { apply_scope: applyScope });
      await loadData();
      toast({
        title:
          applyScope === "all" || applyScope === "series"
            ? "Серия занятий удалена"
            : "Урок удалён",
      });
    } catch (err) {
      toast({
        title: "Не удалось удалить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
      throw err;
    }
  };

  const headerExtra = (
    <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
      <div className="flex gap-1 bg-muted rounded-xl p-1">
        <button
          type="button"
          onClick={() => setMainTab("schedule")}
          className={`min-h-touch px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            mainTab === "schedule"
              ? "bg-card text-brand shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Моё расписание
        </button>
        <button
          type="button"
          onClick={() => setMainTab("availability")}
          className={`min-h-touch px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
            mainTab === "availability"
              ? "bg-card text-brand shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Свободный график
        </button>
      </div>
    </div>
  );

  if (mainTab === "availability") {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
        {headerExtra}
        <TeacherAvailabilityTab teacher={teacher} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <OfflineSnapshotBanner
        fromCache={offlineMeta.fromCache}
        updatedAt={offlineMeta.updatedAt}
        missing={offlineMeta.missing}
        emptyLabel="Расписание пока недоступно без подключения"
        className="mx-4 mt-3 sm:mx-6"
      />
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
        onDeleteLesson={handleDeleteLesson}
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
    </div>
  );
}
