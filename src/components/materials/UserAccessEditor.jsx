import React, { useState, useEffect } from "react";
import { fetchUserAccessEditor, syncUserMaterialAccess } from "@/lib/materialAccess";
import { X, Save, Loader2, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function UserAccessEditor({ targetUser, onClose, onSaved }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [courses, setCourses] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [expandedCourses, setExpandedCourses] = useState(new Set());

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      try {
        const data = await fetchUserAccessEditor(targetUser.userId);
        if (cancelled) return;

        setCourses(data.courses ?? []);
        const granted = new Set();
        for (const course of data.courses ?? []) {
          for (const material of course.materials ?? []) {
            if (material.granted) {
              granted.add(material.id);
            }
          }
        }
        setSelectedIds(granted);
        setExpandedCourses(new Set((data.courses ?? []).map((c) => c.id)));
      } catch (err) {
        console.error("Failed to load access editor:", err);
        if (!cancelled) {
          setCourses([]);
          setSelectedIds(new Set());
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [targetUser.userId]);

  const toggleMaterial = (materialId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(materialId)) {
        next.delete(materialId);
      } else {
        next.add(materialId);
      }
      return next;
    });
  };

  const toggleCourse = (course) => {
    const materialIds = (course.materials ?? []).map((m) => m.id);
    const allSelected = materialIds.length > 0 && materialIds.every((id) => selectedIds.has(id));

    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        materialIds.forEach((id) => next.delete(id));
      } else {
        materialIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const toggleExpanded = (courseId) => {
    setExpandedCourses((prev) => {
      const next = new Set(prev);
      if (next.has(courseId)) {
        next.delete(courseId);
      } else {
        next.add(courseId);
      }
      return next;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await syncUserMaterialAccess(targetUser.userId, Array.from(selectedIds));
      onSaved?.();
      onClose();
    } catch (err) {
      console.error("Failed to save material access:", err);
      alert("Не удалось сохранить доступ");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
        <div className="bg-card rounded-2xl p-8 border border-border">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-600 mx-auto" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl max-w-2xl w-full max-h-[85vh] overflow-y-auto border border-border">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border sticky top-0 bg-card z-10">
          <div>
            <h2 className="text-lg font-bold text-foreground">Настроить доступ</h2>
            <p className="text-sm text-muted-foreground mt-0.5">{targetUser.name}</p>
            <p className="text-xs text-muted-foreground">{targetUser.email}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-xl transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-3">
          {courses.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Нет доступных курсов и материалов для настройки
            </p>
          ) : (
            courses.map((course) => {
              const materialIds = (course.materials ?? []).map((m) => m.id);
              const selectedCount = materialIds.filter((id) => selectedIds.has(id)).length;
              const allSelected =
                materialIds.length > 0 && selectedCount === materialIds.length;
              const partiallySelected = selectedCount > 0 && !allSelected;
              const isExpanded = expandedCourses.has(course.id);

              return (
                <div key={course.id} className="border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center gap-3 p-3 bg-muted/30">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      ref={(el) => {
                        if (el) el.indeterminate = partiallySelected;
                      }}
                      onChange={() => toggleCourse(course)}
                      className="rounded accent-indigo-600"
                    />
                    <button
                      type="button"
                      onClick={() => toggleExpanded(course.id)}
                      className="flex-1 flex items-center gap-2 text-left"
                    >
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-amber-500">📁</span>
                      <span className="text-sm font-semibold text-foreground">{course.name || course.course_name}</span>
                      <span className="text-xs text-muted-foreground ml-auto">
                        {selectedCount}/{materialIds.length}
                      </span>
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="divide-y divide-border">
                      {(course.materials ?? []).map((material) => (
                        <label
                          key={material.id}
                          className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/40 cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={selectedIds.has(material.id)}
                            onChange={() => toggleMaterial(material.id)}
                            className="rounded accent-indigo-600"
                          />
                          <span className="text-sm text-foreground">{material.title}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 gap-2"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Сохранить
          </Button>
        </div>
      </div>
    </div>
  );
}
