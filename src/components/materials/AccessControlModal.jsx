import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { grantAccess, revokeAccess } from "@/lib/materialAccess";
import { X, Users, Lock, Save, Loader2, BookOpen, FolderKanban, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getMaterialTypeInfo } from "@/lib/materialIcons";
import { publicMaterialDescription, unpackMaterialDescription } from "@/lib/materialMeta";
import { openMaterial } from "@/lib/materialUrl";
import { toast } from "@/components/ui/use-toast";
import AccessSourceBadges from "./AccessSourceBadges";

export default function AccessControlModal({ material, course, folders = [], onClose, onSave }) {
  const { user } = useAuth();
  const [tab, setTab] = useState("access");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [revokingKey, setRevokingKey] = useState("");
  const [error, setError] = useState("");
  const [students, setStudents] = useState([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [grants, setGrants] = useState(null);

  const load = async () => {
    setError("");
    setLoading(true);
    try {
      const [sts, grantPayload] = await Promise.all([
        api.students.list(),
        api.materials.access.listForMaterial(material.id),
      ]);

      let visibleStudents = Array.isArray(sts) ? sts : [];
      if (user?.role === "teacher") {
        const teacherId =
          user.teacher_profile_id ||
          (await api.teachers.filter({ user_id: user.id }))[0]?.id;
        visibleStudents = teacherId
          ? visibleStudents.filter((s) => s.assigned_teacher === teacherId)
          : [];
      }

      setStudents(visibleStudents);
      setGrants(grantPayload);
      // Checkbox list is only for NEW grants; already granted students live in «Текущие права».
      setSelectedStudentIds([]);
    } catch (err) {
      console.error(err);
      setError(err.message || "Не удалось загрузить доступы");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!user) return;
    load();
  }, [material.id, user?.id]);

  const toggleStudent = (id) => {
    setSelectedStudentIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  };

  const handleRevokePersonal = async (userId) => {
    setRevokingKey(`user:${userId}`);
    setError("");
    try {
      await revokeAccess(userId, material.id);
      await load();
      onSave?.();
    } catch (err) {
      setError(err.message || "Не удалось отозвать доступ");
    } finally {
      setRevokingKey("");
    }
  };

  const handleRevokeGroup = async (groupId) => {
    setRevokingKey(`group:${groupId}`);
    setError("");
    try {
      await api.materials.access.revoke({
        material_ids: [material.id],
        target_type: "group",
        target_id: groupId,
      });
      await load();
      onSave?.();
    } catch (err) {
      setError(err.message || "Не удалось отозвать доступ группы");
    } finally {
      setRevokingKey("");
    }
  };

  const handleRevokeCourse = async (courseId) => {
    setRevokingKey(`course:${courseId}`);
    setError("");
    try {
      await api.materials.access.revoke({
        material_ids: [material.id],
        target_type: "course",
        target_id: courseId,
      });
      await load();
      onSave?.();
    } catch (err) {
      setError(err.message || "Не удалось отозвать доступ курса");
    } finally {
      setRevokingKey("");
    }
  };

  const handleSavePersonal = async () => {
    if (selectedStudentIds.length === 0) {
      setError("Выберите хотя бы одного ученика");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const grantRole = user?.role === "admin" ? "ADMIN" : "TEACHER";
      const currentGranted = new Set(grants?.user_ids || []);
      const toGrant = selectedStudentIds
        .map((id) => students.find((s) => s.id === id))
        .filter((s) => s?.user_id && !currentGranted.has(s.user_id));

      for (const student of toGrant) {
        await grantAccess(student.user_id, material.id, grantRole);
      }

      toast({
        title: "Доступ выдан",
        description:
          toGrant.length === 1
            ? `${toGrant[0].name || toGrant[0].email} добавлен в текущие права`
            : `Выдано ученикам: ${toGrant.length}`,
      });
      await load();
      await onSave?.();
    } catch (err) {
      console.error("Save error:", err);
      setError(err.message || "Ошибка сохранения доступа");
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

  const personal = grants?.personal || [];
  const groupGrants = grants?.groups || [];
  const courseGrants = grants?.courses || [];
  const folderCourse = grants?.folder_course;
  const hasAnyCurrent =
    personal.length > 0 || groupGrants.length > 0 || courseGrants.length > 0 || Boolean(folderCourse);
  const grantedUserIds = new Set(Array.isArray(grants?.user_ids) ? grants.user_ids : []);
  // Already granted → only in «Текущие права»; checkbox list is for new grants only.
  const studentsWithoutAccess = students.filter(
    (s) => s.user_id && !grantedUserIds.has(s.user_id),
  );
  const studentsWithoutAccount = students.filter((s) => !s.user_id);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div
        className="bg-card rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-border"
        data-testid="access-control-modal"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Материал</h2>
            <p className="text-xs text-muted-foreground mt-0.5">{material.title}</p>
          </div>
          <button type="button" onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 pt-3 flex gap-2 border-b border-border">
          <button
            type="button"
            onClick={() => setTab("info")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "info" ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground"
            }`}
          >
            Информация
          </button>
          <button
            type="button"
            onClick={() => setTab("access")}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px ${
              tab === "access" ? "border-indigo-600 text-indigo-700" : "border-transparent text-muted-foreground"
            }`}
          >
            Доступ
          </button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3">
              {error}
            </div>
          )}

          {tab === "info" && (() => {
            const typeInfo = getMaterialTypeInfo(material.file_type);
            const meta = unpackMaterialDescription(material.description);
            const folder = folders.find((f) => f.id === material.folder_id);
            return (
              <section className="space-y-3 text-sm">
                <div className="rounded-xl border border-border p-4 space-y-2">
                  <p><span className="text-muted-foreground">Название:</span> {material.title}</p>
                  <p><span className="text-muted-foreground">Тип:</span> {typeInfo.label}</p>
                  <p><span className="text-muted-foreground">Курс:</span> {course?.name || course?.course_name || "—"}</p>
                  <p><span className="text-muted-foreground">Папка:</span> {folder?.name || "Корень"}</p>
                  {meta.blockName && (
                    <p><span className="text-muted-foreground">Блок:</span> {meta.blockName}</p>
                  )}
                  <p><span className="text-muted-foreground">Описание:</span> {publicMaterialDescription(material.description) || "—"}</p>
                  {meta.notes && (
                    <p><span className="text-muted-foreground">Заметки:</span> {meta.notes}</p>
                  )}
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await openMaterial(material);
                      } catch (err) {
                        toast({
                          title: "Не удалось открыть материал",
                          description: err?.message || "Попробуйте ещё раз",
                          variant: "destructive",
                        });
                      }
                    }}
                    className="inline-flex text-indigo-600 hover:underline"
                  >
                    Открыть материал
                  </button>
                </div>
              </section>
            );
          })()}

          {tab === "access" && (
          <>
          <div className="p-4 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-800 text-sm text-blue-700 dark:text-blue-300 flex items-start gap-2">
            <Lock className="h-4 w-4 mt-0.5 shrink-0" />
            <p>
              Отметьте учеников ниже и нажмите «Выдать доступ» — они появятся в «Текущих правах».
              Отозвать персональный доступ можно кнопкой «Отозвать» в списке выше.
            </p>
          </div>

          <section className="space-y-3" data-testid="access-current-grants">
            <p className="text-sm font-semibold text-foreground">Текущие права</p>
            {!hasAnyCurrent ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                Явных грантов пока нет. Ученики курса могут видеть материал, если он лежит
                в папке их курса.
              </div>
            ) : (
              <div className="space-y-2">
                {folderCourse && (
                  <div className="flex items-start justify-between gap-3 p-3 rounded-xl border border-border bg-muted/20">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{folderCourse.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{folderCourse.note}</p>
                      <AccessSourceBadges
                        sources={[{ type: "course", label: folderCourse.label }]}
                        className="mt-2"
                      />
                    </div>
                  </div>
                )}

                {personal.map((row) => (
                  <div
                    key={row.user_id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border"
                    data-testid={`access-personal-${row.user_id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{row.name}</p>
                      <p className="text-xs text-muted-foreground">{row.email || row.user_id}</p>
                      <AccessSourceBadges
                        sources={[{ type: "personal", label: row.label }]}
                        className="mt-2"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={revokingKey === `user:${row.user_id}`}
                      onClick={() => handleRevokePersonal(row.user_id)}
                    >
                      {revokingKey === `user:${row.user_id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Отозвать
                        </>
                      )}
                    </Button>
                  </div>
                ))}

                {groupGrants.map((row) => (
                  <div
                    key={row.group_id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border"
                    data-testid={`access-group-${row.group_id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <FolderKanban className="h-4 w-4 text-sky-600" />
                        {row.name}
                      </p>
                      <AccessSourceBadges
                        sources={[{ type: "group", label: row.label }]}
                        className="mt-2"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={revokingKey === `group:${row.group_id}`}
                      onClick={() => handleRevokeGroup(row.group_id)}
                    >
                      {revokingKey === `group:${row.group_id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Отозвать
                        </>
                      )}
                    </Button>
                  </div>
                ))}

                {courseGrants.map((row) => (
                  <div
                    key={row.course_template_id}
                    className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border"
                    data-testid={`access-course-${row.course_template_id}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-amber-600" />
                        {row.name}
                      </p>
                      <AccessSourceBadges
                        sources={[{ type: "course", label: row.label }]}
                        className="mt-2"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-red-600 border-red-200 hover:bg-red-50"
                      disabled={revokingKey === `course:${row.course_template_id}`}
                      onClick={() => handleRevokeCourse(row.course_template_id)}
                    >
                      {revokingKey === `course:${row.course_template_id}` ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <>
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Отозвать
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <p className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4" /> Выдать доступ ученикам
            </p>
            <div className="border border-border rounded-xl divide-y divide-border max-h-64 overflow-y-auto">
              {studentsWithoutAccess.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  {students.length === 0
                    ? "Нет учеников"
                    : "Всем доступным ученикам уже выдан персональный доступ"}
                </div>
              ) : (
                studentsWithoutAccess.map((s) => (
                  <label key={s.id} className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedStudentIds.includes(s.id)}
                      onChange={() => toggleStudent(s.id)}
                      className="rounded accent-indigo-600"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground">{s.name || s.email || "Ученик"}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </div>
                  </label>
                ))
              )}
            </div>
            {studentsWithoutAccount.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Без аккаунта (нельзя выдать доступ): {studentsWithoutAccount.length}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Выбрано: {selectedStudentIds.length}
              {studentsWithoutAccess.length > 0
                ? ` из ${studentsWithoutAccess.length}`
                : ""}
            </p>
          </section>
          </>
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>Закрыть</Button>
          {tab === "access" && (
            <Button
              onClick={handleSavePersonal}
              disabled={saving || selectedStudentIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              data-testid="access-save-personal"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Выдать доступ
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
