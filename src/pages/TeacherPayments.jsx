import { useEffect, useState } from "react";
import { api } from "@/api";
import { DollarSign, CheckCircle2 } from "lucide-react";
import { toast } from "@/components/ui/use-toast";
import { useAuth } from "@/lib/AuthContext";
import { resolveTeacherPaymentLabel } from "@/lib/teacherLabels";

export default function TeacherPayments() {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [rows, setRows] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [lessons, setLessons] = useState([]);

  const load = async () => {
    const payments = isAdmin ? await api.teacherPayments.list() : await api.teacherPayments.my();
    const [t, l] = isAdmin
      ? await Promise.all([api.teachers.list(), api.lessons.list()])
      : [[], []];
    setRows(Array.isArray(payments) ? payments : []);
    setTeachers(t);
    setLessons(l);
  };

  useEffect(() => { load(); }, [isAdmin]);

  const markPaid = async (row) => {
    await api.teacherPayments.update(row.id, { status: "paid" });
    load();
    toast({ title: "Выплата отмечена как paid" });
  };

  const teacherName = (id) => resolveTeacherPaymentLabel(id, teachers);
  const lessonLabel = (id) => {
    const lesson = lessons.find((l) => l.id === id);
    return lesson ? `${lesson.date} ${lesson.start_time}` : id;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-4">
      <div>
        <h2 className="text-xl font-bold">{isAdmin ? "Выплаты преподавателям" : "Мои выплаты"}</h2>
        <p className="text-sm text-muted-foreground">Начисления после завершённых уроков</p>
      </div>

      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="border rounded-xl p-4 bg-card flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold flex items-center gap-2"><DollarSign className="w-4 h-4" /> {Number(row.amount).toFixed(2)} BYN</p>
              <p className="text-xs text-muted-foreground">
                {isAdmin ? `${teacherName(row.teacher_id)} · ` : ""}
                Урок {lessonLabel(row.lesson_id)} · {row.status}
              </p>
            </div>
            {isAdmin && row.status === "pending" && (
              <button onClick={() => markPaid(row)} className="px-3 py-1.5 text-xs bg-emerald-600 text-white rounded-lg flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Paid
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && <p className="text-sm text-muted-foreground">Выплат пока нет</p>}
      </div>
    </div>
  );
}
