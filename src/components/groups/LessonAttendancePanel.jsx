import { useEffect, useState } from "react";
import { api, apiFetch } from "@/api";
import { Check, X, AlertTriangle } from "lucide-react";
import { toast } from "@/components/ui/use-toast";

const STATUS_LABELS = {
  enrolled: "Ожидает",
  attended: "Присутствовал",
  missed: "Отсутствовал (по уважительной причине)",
  missed_no_notice: "Отсутствовал (без уважительной причины)",
  cancelled: "Отменён",
};

const FINAL_STATUSES = new Set(["attended", "missed", "missed_no_notice", "cancelled"]);

export default function LessonAttendancePanel({
  lessonId,
  students = [],
  compact = false,
  isAdmin = true,
  isGroupLesson = false,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!lessonId) return;
    setLoading(true);
    try {
      const data = await api.lessons.attendance.filter({ lesson_id: lessonId });
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      toast({ title: "Не удалось загрузить посещаемость", description: err.message, variant: "destructive" });
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [lessonId]);

  const canEditRow = (row) => {
    if (!isGroupLesson) return false;
    if (isAdmin) return true;
    return !FINAL_STATUSES.has(row.attendance_status);
  };

  const mark = async (id, action) => {
    try {
      if (action === "present") {
        await apiFetch(`/lessons/attendance/${id}/present`, { method: "PATCH" });
      } else if (action === "absent") {
        await apiFetch(`/lessons/attendance/${id}/absent`, { method: "PATCH" });
      } else if (action === "excused") {
        await api.lessons.attendance.update(id, { attendance_status: "missed" });
      } else if (action === "no_notice") {
        await api.lessons.attendance.update(id, { attendance_status: "missed_no_notice" });
      }
      await load();
      toast({ title: "Посещаемость обновлена" });
    } catch (err) {
      toast({ title: "Ошибка", description: err.message, variant: "destructive" });
    }
  };

  if (loading) {
    return <p className="text-xs text-muted-foreground">Загрузка посещаемости…</p>;
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        Записи посещаемости появятся после создания урока для группы.
      </p>
    );
  }

  return (
    <div className={`space-y-2 ${compact ? "" : "mt-2"}`}>
      {!compact && (
        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Посещаемость</p>
      )}
      {rows.map((row) => (
        <div
          key={row.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 min-w-0"
        >
          <div className="min-w-0 flex-1 basis-[10rem]">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 break-words [overflow-wrap:anywhere]">
              {row.student_name ?? row.studentName ?? "—"}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400 break-words">
              {!isGroupLesson && row.attendance_status === "attended"
                ? null
                : STATUS_LABELS[row.attendance_status] || row.attendance_status}
            </p>
          </div>
          {canEditRow(row) ? (
            <div className="flex flex-wrap gap-1 shrink-0">
              <button
                type="button"
                onClick={() => mark(row.id, "present")}
                className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-emerald-200 dark:border-emerald-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                title="Присутствовал"
              >
                <Check className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => mark(row.id, "absent")}
                className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-red-200 dark:border-red-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40"
                title="Отсутствовал"
              >
                <X className="h-3 w-3" />
              </button>
              <button
                type="button"
                onClick={() => mark(row.id, "excused")}
                className="inline-flex min-h-8 min-w-8 items-center justify-center gap-1 rounded-md border border-amber-200 dark:border-amber-800 bg-white dark:bg-slate-900 px-2 py-1 text-[11px] text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40"
                title="Уважительная причина"
              >
                <AlertTriangle className="h-3 w-3" />
              </button>
            </div>
          ) : (
            !isGroupLesson ? (
              row.attendance_status === "attended" ? (
                <p className="text-[11px] text-slate-500 dark:text-slate-400 shrink-0">
                  ✓ Присутствовал
                </p>
              ) : null
            ) : (
              <p className="text-[11px] text-slate-400 dark:text-slate-500 shrink-0">Зафиксировано</p>
            )
          )}
        </div>
      ))}
    </div>
  );
}
