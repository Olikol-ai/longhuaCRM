import { useEffect, useState } from "react";
import { api } from "@/api";
import { Plus, CalendarRange } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function LessonSeriesAdmin() {
  const [series, setSeries] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [form, setForm] = useState({
    course_id: "",
    group_id: "",
    teacher_id: "",
    start_date: "",
    start_time: "10:00",
    frequency: "weekly",
    total_lessons: 35,
    duration: 60,
  });

  const load = async () => {
    const [s, t, g, c] = await Promise.all([
      api.lessonSeries.list(),
      api.teachers.list(),
      api.groups.list(),
      api.courses.list(),
    ]);
    setSeries(s);
    setTeachers(t);
    setGroups(g);
    setCourses(c);
  };

  useEffect(() => { load(); }, []);

  const handleCreate = async () => {
    const result = await api.lessonSeries.create(form);
    toast({
      title: "Серия создана",
      description: `Сгенерировано уроков: ${result.lessonsCreated ?? 0}`,
    });
    load();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold">Серии уроков</h2>
        <p className="text-sm text-muted-foreground">Автогенерация уроков по расписанию</p>
      </div>

      <div className="grid md:grid-cols-3 gap-3 p-4 border rounded-xl bg-card">
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.course_id} onChange={(e) => setForm({ ...form, course_id: e.target.value })}>
          <option value="">Курс</option>
          {courses.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.group_id} onChange={(e) => setForm({ ...form, group_id: e.target.value })}>
          <option value="">Группа</option>
          {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.teacher_id} onChange={(e) => setForm({ ...form, teacher_id: e.target.value })}>
          <option value="">Преподаватель</option>
          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
        <input type="date" className="border rounded-lg px-3 py-2 text-sm" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
        <input type="time" className="border rounded-lg px-3 py-2 text-sm" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
        <select className="border rounded-lg px-3 py-2 text-sm" value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })}>
          <option value="weekly">Еженедельно</option>
          <option value="biweekly">Раз в 2 недели</option>
        </select>
        <input type="number" className="border rounded-lg px-3 py-2 text-sm" placeholder="Всего уроков" value={form.total_lessons} onChange={(e) => setForm({ ...form, total_lessons: Number(e.target.value) })} />
        <button onClick={handleCreate} className="md:col-span-3 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm">
          <Plus className="w-4 h-4" /> Создать серию
        </button>
      </div>

      <div className="space-y-2">
        {series.map((row) => (
          <div key={row.id} className="border rounded-xl p-4 bg-card">
            <p className="font-semibold flex items-center gap-2"><CalendarRange className="w-4 h-4" /> {row.start_date} · {row.total_lessons} уроков</p>
            <p className="text-xs text-muted-foreground">{row.frequency} · {row.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
