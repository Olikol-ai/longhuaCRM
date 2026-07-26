import React, { useEffect, useMemo, useState } from "react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import { getGreetingName } from "@/lib/display-name";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Mail, Phone, Search, Users, MessageCircle } from "lucide-react";

function normalizeSearch(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function formatTelegram(student) {
  const username = String(student.telegram_username || "").trim().replace(/^@/, "");
  if (username) return `@${username}`;
  return "";
}

function studentMatchesQuery(student, query) {
  if (!query) return true;
  const haystack = [
    student.name,
    student.first_name,
    student.last_name,
    student.phone,
    student.email,
  ]
    .filter(Boolean)
    .map((v) => normalizeSearch(v))
    .join(" ");
  return haystack.includes(query);
}

export default function TeacherStudents() {
  const { user } = useAuth();
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [query, setQuery] = useState("");

  const loadData = async () => {
    setLoadError(null);
    setLoading(true);
    try {
      // ACL: GET /students already scopes teachers to assigned_teacher_id.
      const rows = await api.students.list();
      const visible = (Array.isArray(rows) ? rows : []).filter(
        (s) => s.status !== "inactive",
      );
      setStudents(visible);
    } catch (err) {
      setLoadError(err?.message || "Не удалось загрузить учеников");
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return [...students]
      .filter((s) => studentMatchesQuery(s, q))
      .sort((a, b) =>
        String(a.name || "").localeCompare(String(b.name || ""), "ru", {
          sensitivity: "base",
        }),
      );
  }, [students, query]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 text-center py-20 space-y-3">
        <p className="text-slate-600 dark:text-slate-300">{loadError}</p>
        <Button variant="outline" onClick={loadData}>
          Повторить
        </Button>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-3xl mx-auto dark:bg-slate-950 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Мои ученики</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
          Ученики, закреплённые за вами
          {user ? ` · ${getGreetingName(user) || ""}` : ""}
        </p>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по ФИО, телефону или email"
          className="pl-9"
          data-testid="teacher-students-search"
        />
      </div>

      {filtered.length === 0 ? (
        <Card className="p-8 text-center border-dashed">
          <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            {query.trim()
              ? "Никого не найдено по этому запросу"
              : "Пока нет закреплённых учеников"}
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((student) => {
            const phone = String(student.phone || "").trim();
            const email = String(student.email || "").trim();
            const telegram = formatTelegram(student);
            const name = getGreetingName(student) || student.name || "Ученик";

            return (
              <Card
                key={student.id}
                className="p-4 sm:p-5 min-w-0"
                data-testid="teacher-student-card"
              >
                <h2 className="text-base font-semibold text-slate-900 dark:text-white break-words [overflow-wrap:anywhere]">
                  {name}
                </h2>
                <div className="mt-3 space-y-2 text-sm min-w-0">
                  {phone ? (
                    <div className="flex items-start gap-2 min-w-0">
                      <Phone className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Телефон
                        </p>
                        <p className="text-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]">
                          {phone}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {email ? (
                    <div className="flex items-start gap-2 min-w-0">
                      <Mail className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Email
                        </p>
                        <p className="text-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]">
                          {email}
                        </p>
                      </div>
                    </div>
                  ) : null}
                  {telegram ? (
                    <div className="flex items-start gap-2 min-w-0">
                      <MessageCircle className="h-4 w-4 shrink-0 mt-0.5 text-slate-400" />
                      <div className="min-w-0">
                        <p className="text-[11px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          Telegram
                        </p>
                        <p className="text-slate-700 dark:text-slate-200 break-words [overflow-wrap:anywhere]">
                          {telegram}
                        </p>
                      </div>
                    </div>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
