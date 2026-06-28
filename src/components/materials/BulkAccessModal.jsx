import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { grantAccess } from "@/lib/materialAccess";
import { X, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function BulkAccessModal({ teacher, onClose, onSuccess }) {
  const [students, setStudents] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [selectedStudents, setSelectedStudents] = useState(new Set());
  const [selectedMaterials, setSelectedMaterials] = useState(new Set());
  const [selectedCourses, setSelectedCourses] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const load = async () => {
      const me = await api.auth.me();
      setCurrentUser(me);
      const [s, m, c] = await Promise.all([
        api.entities.Student.filter({ status: "active" }),
        api.entities.LessonMaterial.list(),
        api.entities.Course.list(),
      ]);
      setStudents(s);
      setMaterials(m);
      setCourses(c);
      setLoading(false);
    };
    load();
  }, []);

  const toggleStudent = (id) => {
    const newSet = new Set(selectedStudents);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedStudents(newSet);
  };

  const toggleMaterial = (id) => {
    const newSet = new Set(selectedMaterials);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedMaterials(newSet);
  };

  const toggleCourse = (id) => {
    const newSet = new Set(selectedCourses);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedCourses(newSet);
  };

  const handleSave = async () => {
    if (selectedStudents.size === 0 || (selectedMaterials.size === 0 && selectedCourses.size === 0)) {
      alert("Выберите учеников и материалы или курсы");
      return;
    }

    setSaving(true);
    try {
      const grantRole = currentUser?.role === "admin" ? "ADMIN" : "TEACHER";
      const materialIds = new Set(selectedMaterials);

      for (const courseId of selectedCourses) {
        materials
          .filter((m) => m.course_id === courseId)
          .forEach((m) => materialIds.add(m.id));
      }

      for (const matId of materialIds) {
        for (const studentId of selectedStudents) {
          const student = students.find((s) => s.id === studentId);
          if (!student?.user_id) continue;
          await grantAccess(
            student.user_id,
            matId,
            grantRole,
            currentUser?.id ?? teacher?.user_id,
          );
        }
      }

      setSuccess(true);
      setTimeout(() => {
        onSuccess();
        onClose();
      }, 1500);
    } catch (err) {
      console.error(err);
      alert("Ошибка при выдаче доступа");
    }
    setSaving(false);
  };

  if (success) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-card rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-lg font-bold text-foreground mb-1">Доступ выдан!</h3>
          <p className="text-sm text-muted-foreground">{selectedStudents.size} ученик{selectedStudents.size % 10 === 1 ? "у" : "ам"} предоставлен доступ</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full p-6 my-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-foreground">Выдать доступ к материалам</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="space-y-6 max-h-[60vh] overflow-y-auto">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Ученики ({selectedStudents.size})</h3>
              <div className="space-y-2 bg-muted/30 rounded-xl p-4 max-h-[200px] overflow-y-auto">
                {students.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет активных учеников</p>
                ) : (
                  students.map((s) => (
                    <label key={s.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedStudents.has(s.id)}
                        onChange={() => toggleStudent(s.id)}
                        disabled={!s.user_id}
                        className="w-4 h-4 rounded border-2 border-indigo-300 accent-indigo-600"
                      />
                      <span className="text-sm text-foreground">{s.name}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Курсы ({selectedCourses.size})</h3>
              <div className="space-y-2 bg-muted/30 rounded-xl p-4 max-h-[150px] overflow-y-auto">
                {courses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет курсов</p>
                ) : (
                  courses.map((c) => (
                    <label key={c.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedCourses.has(c.id)}
                        onChange={() => toggleCourse(c.id)}
                        className="w-4 h-4 rounded border-2 border-indigo-300 accent-indigo-600"
                      />
                      <span className="text-sm text-foreground">{c.course_name || c.course_type}</span>
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-foreground mb-3">Материалы ({selectedMaterials.size})</h3>
              <div className="space-y-2 bg-muted/30 rounded-xl p-4 max-h-[150px] overflow-y-auto">
                {materials.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Нет материалов</p>
                ) : (
                  materials.map((m) => (
                    <label key={m.id} className="flex items-center gap-3 p-2 hover:bg-muted/50 rounded-lg cursor-pointer transition-colors">
                      <input
                        type="checkbox"
                        checked={selectedMaterials.has(m.id)}
                        onChange={() => toggleMaterial(m.id)}
                        className="w-4 h-4 rounded border-2 border-indigo-300 accent-indigo-600"
                      />
                      <span className="text-sm text-foreground truncate">{m.title}</span>
                    </label>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6 pt-6 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">Отмена</Button>
          <Button
            onClick={handleSave}
            disabled={saving || selectedStudents.size === 0 || (selectedMaterials.size === 0 && selectedCourses.size === 0)}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Выдать доступ
          </Button>
        </div>
      </div>
    </div>
  );
}
