import { useEffect, useState } from "react";
import { api, apiFetch } from "@/api";
import { Check, X } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

export default function Attendance() {
  const [rows, setRows] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [students, setStudents] = useState([]);

  const load = async () => {
    const [attendance, lessonRows, studentRows] = await Promise.all([
      api.lessons.attendance.list(),
      api.lessons.list(),
      api.students.list(),
    ]);
    setRows(attendance);
    setLessons(lessonRows);
    setStudents(studentRows);
  };

  useEffect(() => { load(); }, []);

  const mark = async (id, present) => {
    const path = present ? "present" : "absent";
    await apiFetch(`/lessons/attendance/${id}/${path}`, { method: "PATCH" });
    load();
    toast({ title: present ? "Отмечен присутствующим" : "Отмечен отсутствующим" });
  };

  const lessonLabel = (lessonId) => {
    const lesson = lessons.find((l) => l.id === lessonId);
    return lesson ? `${lesson.date} ${lesson.start_time}` : lessonId;
  };

  const studentName = (id) => students.find((s) => s.id === id)?.name || id;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold">Посещаемость</h2>
        <p className="text-sm text-muted-foreground">Отметка present / absent по урокам</p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="border rounded-xl p-4 bg-card flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">{studentName(row.student_id)}</p>
              <p className="text-xs text-muted-foreground">Урок: {lessonLabel(row.lesson_id)} · {row.attendance_status}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => mark(row.id, true)} className="px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1"><Check className="w-3 h-3" /> Present</button>
              <button onClick={() => mark(row.id, false)} className="px-3 py-1.5 text-xs border rounded-lg flex items-center gap-1"><X className="w-3 h-3" /> Absent</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
