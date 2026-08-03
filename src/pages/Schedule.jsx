import { useState, useEffect, useMemo } from "react";
import { api } from "@/api";
import { createWeeklyLessonSeries } from "@/lib/recurring-lessons";
import { filterSchoolTeacherLessons } from "@/lib/schoolSchedule";
import SchoolScheduleCalendar from "@/components/schedule/SchoolScheduleCalendar";
import { toast } from "@/components/ui/use-toast";

/**
 * Admin school schedule — same calendar UI as teachers,
 * with teacher filter and full admin lesson controls.
 */
export default function Schedule() {
  const [lessons, setLessons] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [students, setStudents] = useState([]);
  const [contacts, setContacts] = useState([]);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [selectedTeacherId, setSelectedTeacherId] = useState("");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [l, t, s, g, c] = await Promise.all([
        api.lessons.list("-date", 500),
        api.teachers.list(),
        api.students.list(),
        api.groups.list(),
        api.teacherStudentContacts.listMine().catch(() => []),
      ]);
      setLessons(filterSchoolTeacherLessons(l));
      setTeachers(t);
      setStudents(s);
      setGroups(g);
      setContacts(Array.isArray(c) ? c : []);
    } catch (err) {
      setError(err.message || "Не удалось загрузить расписание");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

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
      toast({ title: "Информация о занятии обновлена." });
    } catch (err) {
      toast({
        title: "Не удалось обновить урок",
        description:
          err?.message || "Проверьте свободный график и пересечения.",
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleDelete = async (id) => {
    try {
      await api.lessons.delete(id);
      await load();
      toast({ title: "Урок удалён" });
    } catch (err) {
      toast({
        title: "Не удалось удалить урок",
        description: err?.message,
        variant: "destructive",
      });
      throw err;
    }
  };

  const handleMark = async (lesson, status, completionAttendance = "attended") => {
    try {
      const payload =
        status === "completed"
          ? { status, completion_attendance: completionAttendance }
          : { status };
      await api.lessons.update(lesson.id, payload);
      toast({
        title:
          status === "completed"
            ? "Занятие отмечено как проведённое"
            : "Статус занятия обновлён",
      });
      await load();
    } catch (err) {
      toast({
        title: "Не удалось обновить урок",
        description: err?.message || "Попробуйте ещё раз",
        variant: "destructive",
      });
      throw err;
    }
  };

  return (
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
  );
}
