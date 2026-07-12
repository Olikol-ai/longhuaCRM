import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { grantAccess } from "@/lib/materialAccess";
import { X, Loader2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function GrantAccessModal({ user, materialIds, onClose, onSuccess }) {
  const [step, setStep] = useState(1); // 1: select materials, 2: select users
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [materials, setMaterials] = useState([]);
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [teacherEntityId, setTeacherEntityId] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState(new Set(materialIds));
  const [selectedUsers, setSelectedUsers] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [mats, sts, trs] = await Promise.all([
      api.materials.list(),
      api.students.list(),
      api.teachers.list(),
    ]);

    setMaterials(mats);
    setStudents(sts);
    setTeachers(trs);
    if (user?.teacher_profile_id) {
      setTeacherEntityId(user.teacher_profile_id);
    } else if (user?.has_teacher_profile) {
      const ownTeacher = trs.find((t) => t.user_id === user.id);
      setTeacherEntityId(ownTeacher?.id ?? null);
    }
    setLoading(false);
  };

  const toggleMaterial = (id) => {
    const newSet = new Set(selectedMaterials);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMaterials(newSet);
  };

  const toggleUser = (id) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const studentRecords = Array.from(selectedUsers)
        .map(id => students.find(s => s.id === id))
        .filter(Boolean);
      const teacherRecords = Array.from(selectedUsers)
        .map(id => teachers.find(t => t.id === id))
        .filter(Boolean);

      // Определяем роль, от которой выдаем доступ
      const grantRole = user?.role === "admin" ? "ADMIN" : "TEACHER";

      for (const matId of selectedMaterials) {
        for (const student of studentRecords) {
          if (student.user_id) {
            await grantAccess(student.user_id, matId, grantRole, user?.id);
          }
        }
        for (const teacher of teacherRecords) {
          // Только админ может выдавать доступ учителям
          if (user?.role === "admin" && teacher.user_id) {
            await grantAccess(teacher.user_id, matId, grantRole, user?.id);
          }
        }
      }

      onSuccess();
    } catch (err) {
      console.error("Save error:", err);
      alert("Ошибка при предоставлении доступа");
    } finally {
      setSaving(false);
    }
  };

  const isTeacherScope = Boolean(user?.has_teacher_profile && user?.role !== "admin");
  const visibleStudents = isTeacherScope && teacherEntityId
    ? students.filter((s) => s.assigned_teacher === teacherEntityId)
    : students;

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <Card className="p-8">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {step === 1 ? "Выберите материалы" : "Выберите пользователей"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 1
                ? `Выбрано ${selectedMaterials.size} материалов`
                : `Выбрано ${selectedUsers.size} пользователей`}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {step === 1 ? (
            // Step 1: Select materials
            <div className="space-y-2">
              {materials.map(mat => {
                const isSelected = selectedMaterials.has(mat.id);
                return (
                  <label
                    key={mat.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-indigo-50 border border-indigo-200"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMaterial(mat.id)}
                      className="w-4 h-4 rounded accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {mat.title}
                      </p>
                      {mat.block_name && (
                        <p className="text-xs text-muted-foreground">
                          {mat.block_name}
                        </p>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            // Step 2: Select users
            <>
              {visibleStudents.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Ученики
                  </h3>
                  <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                    {visibleStudents.map(s => (
                      <label
                        key={s.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(s.id)}
                          onChange={() => toggleUser(s.id)}
                          className="w-4 h-4 rounded accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {s.name}
                          </p>
                          {s.email && (
                            <p className="text-xs text-muted-foreground">
                              {s.email}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}

              {user?.role === "admin" && teachers.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                    <Users className="h-4 w-4" /> Преподаватели
                  </h3>
                  <div className="space-y-2 bg-muted/30 rounded-lg p-3">
                    {teachers.map(t => (
                      <label
                        key={t.id}
                        className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded cursor-pointer transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={selectedUsers.has(t.id)}
                          onChange={() => toggleUser(t.id)}
                          className="w-4 h-4 rounded accent-indigo-600"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">
                            {t.name}
                          </p>
                          {t.email && (
                            <p className="text-xs text-muted-foreground">
                              {t.email}
                            </p>
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-3 p-6 border-t border-border sticky bottom-0 bg-card">
          {step === 2 && (
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              disabled={saving}
              className="flex-1"
            >
              Назад
            </Button>
          )}
          {step === 1 ? (
            <Button
              onClick={() => setStep(2)}
              disabled={selectedMaterials.size === 0}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              Далее
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={selectedUsers.size === 0 || saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Сохранение...
                </>
              ) : (
                "Предоставить доступ"
              )}
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}