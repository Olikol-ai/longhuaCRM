import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, GraduationCap, Loader2 } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";

function contactLabel(student) {
  const phone = String(student.phone ?? "").trim();
  const email = String(student.email ?? "").trim();
  if (phone && email) return `${phone} · ${email}`;
  if (phone) return phone;
  if (email) return email;
  return "—";
}

function balanceValue(student) {
  const raw = student.lesson_balance ?? student.lessonBalance ?? 0;
  return Number(raw) || 0;
}

/**
 * Dedicated admin list: students with lesson_balance <= 2.
 * Data source: GET /students/low-balance (no client-side balance filtering).
 */
export default function LowBalanceStudents() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await api.students.lowBalance();
        if (!cancelled) {
          setRows(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setRows([]);
          toast({
            title: "Не удалось загрузить список",
            description: err?.message,
            variant: "destructive",
          });
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6 w-full min-w-0">
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <div>
          <Link
            to={createPageUrl("Dashboard")}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="w-3 h-3" /> На главную
          </Link>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Ученики с низким остатком занятий
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Активные ученики, у которых осталось 2 занятия или меньше
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Загрузка…
        </div>
      ) : rows.length === 0 ? (
        <Card className="text-center py-12">
          <GraduationCap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            Нет учеников с низким остатком занятий
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto border border-border rounded-xl bg-card">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">Ученик</th>
                <th className="px-4 py-3 font-medium">Осталось занятий</th>
                <th className="px-4 py-3 font-medium">Контакты</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((student) => {
                const balance = balanceValue(student);
                return (
                  <tr
                    key={student.id}
                    className="border-b border-border last:border-0"
                  >
                    <td className="px-4 py-3 font-medium text-foreground">
                      {student.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex text-xs font-bold px-2 py-1 rounded-full ${
                          balance === 0
                            ? "bg-red-100 text-red-600 dark:bg-red-950/50 dark:text-red-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                        }`}
                      >
                        {balance}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {contactLabel(student)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
