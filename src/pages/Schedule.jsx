import { useState, useEffect, useMemo } from "react";
import { api } from "@/api";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";
import { filterSchoolTeacherLessons } from "@/lib/schoolSchedule";
import SchoolScheduleCalendar from "@/components/schedule/SchoolScheduleCalendar";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { OFFLINE_RESOURCES, readWithOfflineFallback } from "@/lib/offline";
import { OfflineSnapshotBanner } from "@/components/pwa/OfflineSnapshotBanner";

/**
 * Admin school schedule — same calendar UI as teachers,
 * with teacher filter and full admin lesson controls.
 */
export default function Schedule() {
  const { user } = useAuth();
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });

  const load = async () => {
    setLoading(true);
    setError("");
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'admin',
        resource: OFFLINE_RESOURCES.SCHEDULE,
        resourceKey: 'admin',
        fetcher: async () => {
          const [l, t, s, g, c] = await Promise.all([
            api.lessons.list("-date", 500),
            api.teachers.list(),
            api.students.list(),
            api.groups.list(),
            api.teacherStudentContacts.listMine().catch(() => []),
          ]);
          return {
            lessons: filterSchoolTeacherLessons(l),
            teachers: t,
            students: s,
            groups: g,
            contacts: Array.isArray(c) ? c : [],
          };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      if (result.missing || !result.data) {
        setError("Расписание пока недоступно без подключения");
        setLessons([]);
        setTeachers([]);
        setStudents([]);
        setGroups([]);
        setContacts([]);
        return;
      }
      const payload = result.data;
      setLessons(payload.lessons || []);
      setTeachers(payload.teachers || []);
      setStudents(payload.students || []);
      setGroups(payload.groups || []);
      setContacts(payload.contacts || []);
    } catch (err) {
      setError(err.message || "Не удалось загрузить расписание");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.id) void load();
  }, [user?.id]);

  const visibleLessons = useMemo(() => {
    if (!selectedTeacherId) return lessons;
    return lessons.filter((lesson) => lesson.teacher_id === selectedTeacherId);
  }, [lessons, selectedTeacherId]);

  const handleCreate = async (data, recurring) => {
    try {
      await createWeeklyLessonSeries(
        (payload) => api.lessons.create(payload),
        data,
        recurring,
        {
          createRecurring: (payload) => api.lessons.createRecurring(payload),
          untilDate: data.recurrence_until || null,
        },
      );
      await load();
      toast({ title: "Урок создан" });
    } catch (err) {
      toast({
        title: "Не удалось сохранить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleUpdate = async (id, data) => {
    try {
      await api.lessons.update(id, data);
      await load();
      const series =
        data?.apply_scope === "all" ||
        data?.apply_scope === "series" ||
        data?.applyScope === "all" ||
        data?.applyScope === "series";
      toast({
        title:
          data?.status === "cancelled"
            ? series
              ? "Занятия серии отменены"
              : "Урок отменён"
            : "Информация о занятии обновлена.",
      });
    } catch (err) {
      toast({
        title:
          data?.status === "cancelled"
            ? "Не удалось отменить урок"
            : "Не удалось обновить урок",
        description:
          err?.message || "Проверьте свободный график и пересечения.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleDelete = async (id, applyScope = "this") => {
    try {
      await api.lessons.delete(id, { apply_scope: applyScope });
      await load();
      toast({
        title:
          applyScope === "all" || applyScope === "series"
            ? "Серия занятий удалена"
            : "Урок удалён",
      });
    } catch (err) {
      toast({
        title: "Не удалось удалить урок",
        description: err?.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleMark = async (lesson, status, completionAttendance = "attended", applyScope = "this") => {
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
            ? "Занятие отмечено как проведённое"
            : status === "cancelled"
              ? series
                ? "Занятия серии отменены"
                : "Урок отменён"
              : "Статус занятия обновлён",
      });
      await load();
    } catch (err) {
      toast({
        title:
          status === "cancelled"
            ? "Не удалось отменить урок"
            : "Не удалось обновить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
      throw err;
    }
  };

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
        title="Расписание"
        role="admin"
        lessons={visibleLessons}
        teachers={teachers}
        students={students}
        contacts={contacts}
        groups={groups}
        loading={loading}
        error={error || null}
        onRetry={() => {
          setLoading(true);
          load();
        }}
        showTeacherFilter
        selectedTeacherId={selectedTeacherId}
        onSelectedTeacherIdChange={setSelectedTeacherId}
        defaultTeacherId={selectedTeacherId}
        onCreateLesson={handleCreate}
        onUpdateLesson={handleUpdate}
        onDeleteLesson={handleDelete}
        onMarkLesson={handleMark}
        onLessonsLocalPatch={(updated) => {
          setLessons((prev) =>
            prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)),
          );
        }}
        showAttendance
        showQuickActions
        createButtonLabel="Создать занятие"
      />
    </div>
  );
}
