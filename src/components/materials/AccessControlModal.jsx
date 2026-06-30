import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { grantAccess, revokeAccess } from "@/lib/materialAccess";
import { X, Users, Lock, Save, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AccessControlModal({ material, course, onClose, onSave }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [initialGrantedUserIds, setInitialGrantedUserIds] = useState(new Set());

  useEffect(() => {
    if (!user) return;

    const load = async () => {
      const [sts, accesses] = await Promise.all([
        api.entities.Student.list(),
        api.entities.MaterialAccess.filter({
          material_id: material.id,
          granted_by_role: user.role === "admin" ? "ADMIN" : "TEACHER",
        }),
      ]);

      setStudents(sts);

      const grantedUserIds = new Set(
        accesses.filter((a) => a.access === true).map((a) => a.user_id),
      );
      setInitialGrantedUserIds(grantedUserIds);

      const selected = sts
        .filter((s) => s.user_id && grantedUserIds.has(s.user_id))
        .map((s) => s.id);
      setSelectedStudentIds(selected);
      setLoading(false);
    };
    load();
  }, [material.id, user?.id]);

  const toggleStudent = (id) => {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const grantRole = user?.role === "admin" ? "ADMIN" : "TEACHER";
      const selectedUserIds = new Set(
        selectedStudentIds
          .map((id) => students.find((s) => s.id === id)?.user_id)
          .filter(Boolean),
      );

      for (const student of students) {
        if (!student.user_id) continue;
        const wasGranted = initialGrantedUserIds.has(student.user_id);
        const shouldGrant = selectedUserIds.has(student.user_id);

        if (shouldGrant && !wasGranted) {
          await grantAccess(student.user_id, material.id, grantRole, user.id);
        } else if (!shouldGrant && wasGranted) {
          await revokeAccess(student.user_id, material.id, grantRole);
        }
      }

      onSave();
    } catch (err) {
      console.error("Save error:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-card rounded-2xl p-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-lg font-bold text-foreground">Управление доступом</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{material.title}</p>
            {course?.course_name && (
              <p className="text-xs text-muted-foreground">{course.course_name}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>Доступ выдаётся по учётной записи ученика (user_id). Изменения сохраняются на сервере.</p>
          </div>

          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Выберите учеников
            </p>
            <div className="border border-border rounded-xl divide-y divide-border max-h-64 overflow-y-auto">
              {students.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">Нет учеников</div>
              ) : (
                students.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      disabled={!s.user_id}
                      className="rounded accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.user_id ? s.email : "Нет привязанного аккаунта"}
                      </p>
                    </div>
                  </label>
                ))
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Выбрано: {selectedStudentIds.length} из {students.length}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить доступ
          </Button>
        </div>
      </div>
    </div>
  );
}
