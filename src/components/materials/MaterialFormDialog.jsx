import React, { useState, useEffect } from "react";
import { api } from "@/api";
import { X, Upload, Loader2, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export default function MaterialFormDialog({ onClose, onSave }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    course_id: "",
    block_name: "",
    file_type: "other",
  });
  const [file, setFile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadCourses();
  }, []);

  const loadCourses = async () => {
    const c = await api.entities.Course.list();
    setCourses(c);
    if (c.length > 0) {
      setFormData(prev => ({ ...prev, course_id: c[0].id }));
    }
    setLoading(false);
  };

  const detectFileType = (filename) => {
    const ext = filename.split(".").pop().toLowerCase();
    const typeMap = {
      pdf: "pdf",
      pptx: "pptx",
      ppt: "pptx",
      mp4: "video",
      webm: "video",
      mov: "video",
      "3gp": "video",
      link: "link",
    };
    return typeMap[ext] || "other";
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const detectedType = detectFileType(f.name);
      if (!formData.title) {
        setFormData(prev => ({
          ...prev,
          title: f.name.replace(/\.[^/.]+$/, ""),
          file_type: detectedType,
        }));
      }
    }
  };

  const handleSave = async () => {
    if (!formData.title || !formData.course_id || !file) {
      alert("Заполните все обязательные поля и выберите файл");
      return;
    }

    setSaving(true);
    try {
      // Upload file
      const uploadedFile = await api.uploads.uploadFile({
        file: file,
      });

      // Create material record
      await api.entities.LessonMaterial.create({
        title: formData.title,
        description: formData.description || "",
        course_id: formData.course_id,
        block_name: formData.block_name || "",
        file_type: formData.file_type,
        file_url: uploadedFile.file_url,
        tags: [],
      });

      onSave();
    } catch (err) {
      console.error("Save error:", err);
      alert("Ошибка при загрузке материала");
    } finally {
      setSaving(false);
    }
  };

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
      <Card className="max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-lg font-bold text-foreground">Добавить материал</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {/* File upload */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Файл *
            </label>
            <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-300 rounded-lg cursor-pointer hover:border-indigo-400 transition-colors">
              {file ? (
                <div className="flex items-center gap-2 text-sm text-foreground">
                  <File className="h-4 w-4" />
                  {file.name}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Upload className="h-4 w-4" />
                  Выберите файл
                </div>
              )}
              <input
                type="file"
                onChange={handleFileChange}
                className="hidden"
                accept=".pdf,.pptx,.ppt,.mp4,.webm,.mov,.3gp,.jpg,.jpeg,.png"
              />
            </label>
          </div>

          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Название *
            </label>
            <Input
              value={formData.title}
              onChange={e =>
                setFormData(prev => ({ ...prev, title: e.target.value }))
              }
              placeholder="Название материала"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Описание
            </label>
            <textarea
              value={formData.description}
              onChange={e =>
                setFormData(prev => ({ ...prev, description: e.target.value }))
              }
              placeholder="Описание материала"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm"
              rows="3"
            />
          </div>

          {/* Course */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Курс *
            </label>
            <select
              value={formData.course_id}
              onChange={e =>
                setFormData(prev => ({ ...prev, course_id: e.target.value }))
              }
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
            >
              {courses.map(c => (
                <option key={c.id} value={c.id}>
                  {c.course_name || c.course_type}
                </option>
              ))}
            </select>
          </div>

          {/* Block name */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Блок/Раздел
            </label>
            <Input
              value={formData.block_name}
              onChange={e =>
                setFormData(prev => ({ ...prev, block_name: e.target.value }))
              }
              placeholder="Например: Блок 1"
            />
          </div>

          {/* File type */}
          <div>
            <label className="block text-sm font-medium text-foreground mb-2">
              Тип файла
            </label>
            <select
              value={formData.file_type}
              onChange={e =>
                setFormData(prev => ({ ...prev, file_type: e.target.value }))
              }
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background"
            >
              <option value="pdf">PDF</option>
              <option value="pptx">PowerPoint</option>
              <option value="video">Видео</option>
              <option value="link">Ссылка</option>
              <option value="other">Другое</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-border">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.title || !formData.course_id || !file}
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Загрузка...
              </>
            ) : (
              "Добавить"
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}