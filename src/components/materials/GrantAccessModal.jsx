import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { grantMaterialAccess } from "@/lib/materialAccess";
import { X, Loader2, Users, BookOpen, FolderKanban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function GrantAccessModal({ user, materialIds, onClose, onSuccess }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [materials, setMaterials] = useState([]);
  const [students, setStudents] = useState([]);
  const [groups, setGroups] = useState([]);
  const [courses, setCourses] = useState([]);
  const [teacherEntityId, setTeacherEntityId] = useState(null);
  const [selectedMaterials, setSelectedMaterials] = useState(new Set(materialIds));
  const [targetType, setTargetType] = useState("student");
  const [selectedTargets, setSelectedTargets] = useState(new Set());

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setError("");
    try {
      if (user?.role === "tutor") {
        const [mats, sts] = await Promise.all([
          api.materials.list(),
          api.tutors.myStudents(),
        ]);
        setMaterials(Array.isArray(mats) ? mats : []);
        setStudents(
          (Array.isArray(sts) ? sts : []).map((s) => ({
            id: s.id,
            name: s.name || [s.first_name, s.last_name].filter(Boolean).join(" ") || s.email,
            email: s.email || "",
            user_id: s.user_id || null,
            is_tutor_student: true,
          })),
        );
        setGroups([]);
        setCourses([]);
        setTargetType("tutor_student");
      } else {
        const [mats, sts, grps, crs, trs] = await Promise.all([
          api.materials.list(),
          api.students.list(),
          api.groups.list(),
          api.courses.list(),
          api.teachers.list(),
        ]);

        setMaterials(Array.isArray(mats) ? mats : []);
        setStudents(Array.isArray(sts) ? sts : []);
        setGroups(Array.isArray(grps) ? grps : []);
        setCourses(Array.isArray(crs) ? crs : []);

        if (user?.teacher_profile_id) {
          setTeacherEntityId(user.teacher_profile_id);
        } else if (user?.has_teacher_profile) {
          const ownTeacher = (Array.isArray(trs) ? trs : []).find((t) => t.user_id === user.id);
          setTeacherEntityId(ownTeacher?.id ?? null);
        }
      }
    } catch (err) {
      setError(err.message || "Не удалось загрузить данные");
    } finally {
      setLoading(false);
    }
  };

  const toggleMaterial = (id) => {
    const next = new Set(selectedMaterials);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedMaterials(next);
  };

  const toggleTarget = (id) => {
    const next = new Set(selectedTargets);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTargets(next);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      const isTutor = user?.role === "tutor";
      const grantRole = user?.role === "admin" ? "ADMIN" : isTutor ? "TUTOR" : "TEACHER";
      const matIds = Array.from(selectedMaterials);

      for (const targetId of selectedTargets) {
        if (targetType === "tutor_student" || (isTutor && targetType === "student")) {
          await grantMaterialAccess({
            materialIds: matIds,
            targetType: "tutor_student",
            targetId,
            grantedByRole: grantRole,
          });
        } else if (targetType === "student") {
          const student = students.find((s) => s.id === targetId);
          if (!student?.user_id) {
            throw new Error(
              `У ученика «${student?.name || targetId}» нет аккаунта — доступ выдать нельзя`,
            );
          }
          await grantMaterialAccess({
            materialIds: matIds,
            targetType: "student",
            targetId,
            grantedByRole: grantRole,
          });
        } else if (targetType === "group") {
          await grantMaterialAccess({
            materialIds: matIds,
            targetType: "group",
            targetId,
            grantedByRole: grantRole,
          });
        } else if (targetType === "course") {
          await grantMaterialAccess({
            materialIds: matIds,
            targetType: "course",
            targetId,
            grantedByRole: grantRole,
          });
        }
      }

      onSuccess();
    } catch (err) {
      setError(err.message || "Ошибка при предоставлении доступа");
    } finally {
      setSaving(false);
    }
  };

  const isTutorScope = user?.role === "tutor";
  const isTeacherScope = Boolean(user?.has_teacher_profile && user?.role !== "admin");
  const visibleStudents = isTeacherScope && teacherEntityId
    ? students.filter((s) => s.assigned_teacher === teacherEntityId)
    : students;
  const visibleGroups = isTeacherScope && teacherEntityId
    ? groups.filter((g) => g.teacher_id === teacherEntityId)
    : groups;

  const targetList =
    targetType === "tutor_student" || (isTutorScope && targetType === "student")
      ? visibleStudents.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: s.user_id ? (s.email || "Есть аккаунт") : "Локальный ученик",
          disabled: false,
        }))
      : targetType === "student"
      ? visibleStudents.map((s) => ({
          id: s.id,
          title: s.name,
          subtitle: s.user_id ? (s.email || "Есть аккаунт") : "Нет аккаунта",
          disabled: !s.user_id,
        }))
      : targetType === "group"
        ? visibleGroups.map((g) => ({
            id: g.id,
            title: g.name,
            subtitle: g.status || "группа",
            disabled: false,
          }))
        : courses.map((c) => ({
            id: c.id,
            title: c.name || c.course_name || "Курс",
            subtitle: "курс",
            disabled: false,
          }));

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <Card className="p-8">
          <Loader2 className="h-6 w-6 animate-spin text-brand mx-auto" />
        </Card>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {step === 1 ? "Выберите материалы" : "Кому выдать доступ"}
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 1
                ? `Выбрано ${selectedMaterials.size} материалов`
                : `Тип: ${targetType === "student" ? "ученик" : targetType === "group" ? "группа" : "курс"} · выбрано ${selectedTargets.size}`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-2">
              {materials.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-6">Нет материалов</p>
              )}
              {materials.map((mat) => {
                const isSelected = selectedMaterials.has(mat.id);
                return (
                  <label
                    key={mat.id}
                    className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                      isSelected
                        ? "bg-brand-soft dark:bg-brand-soft/40 border border-brand/30 dark:border-brand/50"
                        : "hover:bg-muted/30"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleMaterial(mat.id)}
                      className="w-4 h-4 rounded accent-brand"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{mat.title}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {(isTutorScope
                  ? [{ id: "tutor_student", label: "Ученик", icon: Users }]
                  : [
                      { id: "student", label: "Ученик", icon: Users },
                      { id: "group", label: "Группа", icon: FolderKanban },
                      ...(user?.role === "admin"
                        ? [{ id: "course", label: "Курс", icon: BookOpen }]
                        : []),
                    ]
                ).map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setTargetType(tab.id);
                        setSelectedTargets(new Set());
                      }}
                      className={`px-3 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors ${
                        targetType === tab.id
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              <div className="space-y-2 bg-muted/30 rounded-lg p-3 max-h-80 overflow-y-auto">
                {targetList.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    Нет доступных получателей
                  </p>
                )}
                {targetList.map((item) => (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 p-2 rounded transition-colors ${
                      item.disabled
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-muted/50 cursor-pointer"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTargets.has(item.id)}
                      disabled={item.disabled}
                      onChange={() => toggleTarget(item.id)}
                      className="w-4 h-4 rounded accent-brand"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.subtitle}</p>
                    </div>
                  </label>
                ))}
              </div>
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
              className="flex-1 bg-primary hover:bg-primary/90"
            >
              Далее
            </Button>
          ) : (
            <Button
              onClick={handleSave}
              disabled={selectedTargets.size === 0 || saving}
              className="flex-1 bg-primary hover:bg-primary/90"
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
