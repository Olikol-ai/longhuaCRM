import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertCircle, ArrowLeft, GraduationCap, Loader2 } from "lucide-react";
import { api } from "@/api";
import { createPageUrl } from "@/utils";
import { Card } from "@/components/ui/card";
import { toast } from "@/components/ui/use-toast";
import { getLessonBalance } from "@/lib/lessonBalance";
import LessonBalanceDisplay from "@/components/students/LessonBalanceDisplay";

function contactLabel(student) {
  const phone = String(student.phone ?? "").trim();
  const email = String(student.email ?? "").trim();
  if (phone && email) return `${phone} · ${email}`;
  if (phone) return phone;
  if (email) return email;
  return "—";
}

/**
 * Dedicated admin list: students with lesson_balance <= 2 (includes debt).
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
            description: err?.message || "Попробуйте обновить страницу",
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
    <div className="p-6 lg:p-8 max-w-5xl mx-auto space-y-6">
      <div className="flex items-start gap-3">
        <Link
          to={createPageUrl("Dashboard")}
          className="mt-1 p-2 rounded-lg text-muted-foreground hover:bg-muted"
          aria-label="Назад"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            Ученики с низким остатком занятий
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Активные ученики с остатком ≤ 2 занятий, включая задолженность (отрицательный баланс)
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
        <>
          <div className="lg:hidden space-y-3">
            {rows.map((student) => {
              const balance = getLessonBalance(student);
              return (
                <article
                  key={student.id}
                  className="rounded-2xl border border-border bg-card p-4 space-y-2"
                >
                  <p className="font-semibold text-foreground break-words">{student.name}</p>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted-foreground">Осталось:</span>
                    <LessonBalanceDisplay balance={balance} variant="badge" />
                  </div>
                  <p className="text-sm text-muted-foreground break-words">{contactLabel(student)}</p>
                </article>
              );
            })}
          </div>
          <div className="overflow-x-auto border border-border rounded-xl bg-card hidden lg:block">
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
                  const balance = getLessonBalance(student);
                  return (
                    <tr
                      key={student.id}
                      className="border-b border-border last:border-0"
                    >
                      <td className="px-4 py-3 font-medium text-foreground">
                        {student.name}
                      </td>
                      <td className="px-4 py-3">
                        <LessonBalanceDisplay balance={balance} variant="badge" />
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
        </>
      )}
    </div>
  );
}
