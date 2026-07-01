import React, { useState, useEffect } from "react";
import { api } from "@/api";
import { useAuth } from "@/lib/AuthContext";
import { Users, Loader2, Settings2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import UserAccessEditor from "@/components/materials/UserAccessEditor";

export default function AccessManagementPanel({ isAdmin }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [userTypeTab, setUserTypeTab] = useState("students");
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [editingUser, setEditingUser] = useState(null);

  useEffect(() => {
    void loadUsers();
  }, [isAdmin, user?.id]);

  const loadUsers = async () => {
    setLoading(true);
    try {
      if (isAdmin) {
        const [stsResult, trsResult] = await Promise.allSettled([
          api.entities.Student.list(),
          api.entities.Teacher.list(),
        ]);

        if (stsResult.status === "fulfilled") {
          setStudents(
            (Array.isArray(stsResult.value) ? stsResult.value : []).filter((s) => s.user_id),
          );
        } else {
          console.error("Failed to load students:", stsResult.reason);
          setStudents([]);
        }

        if (trsResult.status === "fulfilled") {
          setTeachers(
            (Array.isArray(trsResult.value) ? trsResult.value : []).filter((t) => t.user_id),
          );
        } else {
          console.error("Failed to load teachers:", trsResult.reason);
          setTeachers([]);
        }
      } else {
        const stsResult = await Promise.allSettled([api.entities.Student.list()]);
        if (stsResult[0].status === "fulfilled") {
          const allStudents = Array.isArray(stsResult[0].value) ? stsResult[0].value : [];
          const teacherId =
            user?.teacher_profile_id ||
            (await api.entities.Teacher.filter({ user_id: user.id }))[0]?.id;

          setStudents(
            teacherId
              ? allStudents.filter(
                  (s) => s.user_id && s.assigned_teacher === teacherId,
                )
              : [],
          );
        } else {
          console.error("Failed to load students:", stsResult[0].reason);
          setStudents([]);
        }
        setTeachers([]);
      }
    } catch (err) {
      console.error("AccessManagementPanel loadUsers error:", err);
      setStudents([]);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
      </div>
    );
  }

  const activeList =
    isAdmin && userTypeTab === "teachers"
      ? teachers.map((t) => ({
          userId: t.user_id,
          name: t.name,
          email: t.email,
          type: "teacher",
        }))
      : students.map((s) => ({
          userId: s.user_id,
          name: s.name,
          email: s.email,
          type: "student",
        }));

  const emptyMessage =
    isAdmin && userTypeTab === "teachers"
      ? "Нет преподавателей с привязанными аккаунтами"
      : isAdmin
        ? "Нет учеников с привязанными аккаунтами"
        : "Нет назначенных учеников с аккаунтами";

  return (
    <div className="space-y-4">
      {isAdmin && (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setUserTypeTab("students")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userTypeTab === "students"
                ? "bg-indigo-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Ученики
          </button>
          <button
            type="button"
            onClick={() => setUserTypeTab("teachers")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              userTypeTab === "teachers"
                ? "bg-indigo-600 text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            Преподаватели
          </button>
        </div>
      )}

      {activeList.length === 0 ? (
        <Card className="p-12 text-center border-dashed">
          <Users className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-medium">{emptyMessage}</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {activeList.map((row) => (
            <Card key={row.userId} className="p-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300">
                    {row.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-foreground truncate">{row.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => setEditingUser(row)}
                className="gap-2 shrink-0"
              >
                <Settings2 className="h-4 w-4" />
                Настроить доступ
              </Button>
            </Card>
          ))}
        </div>
      )}

      {editingUser && (
        <UserAccessEditor
          targetUser={editingUser}
          onClose={() => setEditingUser(null)}
          onSaved={() => {
            setEditingUser(null);
          }}
        />
      )}
    </div>
  );
}
