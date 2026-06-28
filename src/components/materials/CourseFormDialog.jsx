import React, { useState, useEffect } from "react";
import { api } from '@/api';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Loader2, Folder } from "lucide-react";

export default function CourseFormDialog({ course, onClose, onSave }) {
  const [form, setForm] = useState({ course_name: "", course_type: "basic_beginner", notes: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (course) {
      setForm({
        course_name: course.course_name || "",
        course_type: course.course_type || "basic_beginner",
        notes: course.notes || "",
      });
    }
  }, [course]);

  const handleSave = async () => {
    if (!form.course_name.trim()) return;
    setSaving(true);
    let saved;
    if (course) {
      saved = await api.entities.Course.update(course.id, form);
    } else {
      saved = await api.entities.Course.create(form);
    }
    setSaving(false);
    onSave(saved);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <Folder className="h-4 w-4 text-amber-500" />
            </div>
            <h3 className="text-base font-semibold text-slate-800">
              {course ? "Переименовать курс" : "Новый курс"}
            </h3>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Название курса *</label>
            <Input
              value={form.course_name}
              onChange={e => setForm(f => ({ ...f, course_name: e.target.value }))}
              placeholder="Например: Базовый курс — Начинающие"
              autoFocus
              onKeyDown={e => e.key === "Enter" && handleSave()}
            />
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Тип</label>
            <select
              value={form.course_type}
              onChange={e => setForm(f => ({ ...f, course_type: e.target.value }))}
              className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="basic_beginner">Базовый — Начинающие</option>
              <option value="advanced_beginner">Продвинутый — Начинающие</option>
              <option value="advanced">Продвинутый</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-medium text-slate-600 mb-1.5 block">Описание</label>
            <Input
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Краткое описание курса"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100">
          <Button variant="outline" onClick={onClose}>Отмена</Button>
          <Button
            className="bg-indigo-600 hover:bg-indigo-700"
            disabled={!form.course_name.trim() || saving}
            onClick={handleSave}
          >
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            {course ? "Сохранить" : "Создать"}
          </Button>
        </div>
      </div>
    </div>
  );
}