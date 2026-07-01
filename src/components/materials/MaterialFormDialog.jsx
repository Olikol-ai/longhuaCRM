import React, { useState, useEffect } from "react";
import { api } from "@/api";
import { X, Upload, Loader2, File, Link2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function getErrorMessage(err) {
  return (
    err?.data?.message ||
    err?.message ||
    "Не удалось сохранить материал. Проверьте файл и попробуйте снова."
  );
}

export default function MaterialFormDialog({ onClose, onSave, defaultCourseId = "", defaultFolderId = null }) {
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    notes: "",
    course_id: defaultCourseId,
    folder_id: defaultFolderId || "",
    block_name: "",
    file_type: "other",
    external_link: "",
  });
  const [sourceMode, setSourceMode] = useState("file");
  const [file, setFile] = useState(null);
  const [courses, setCourses] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);

  useEffect(() => {
    loadCourses();
  }, []);

  useEffect(() => {
    if (formData.course_id) {
      loadFolders(formData.course_id);
    } else {
      setFolders([]);
    }
  }, [formData.course_id]);

  const loadCourses = async () => {
    try {
      const c = await api.entities.Course.list();
      setCourses(Array.isArray(c) ? c : []);
      if (!formData.course_id && c.length > 0) {
        setFormData((prev) => ({ ...prev, course_id: c[0].id }));
      }
    } catch (err) {
      console.error("Failed to load courses for material form:", err);
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const loadFolders = async (courseId) => {
    try {
      const all = await api.entities.CourseFolder.filter({ course_id: courseId });
      setFolders(Array.isArray(all) ? all : []);
    } catch (err) {
      console.error("Failed to load folders for material form:", err);
      setFolders([]);
    }
  };

  const dismissSaveError = () => {
    setSaveError(null);
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
    };
    return typeMap[ext] || "other";
  };

  const detectLinkType = (url) => {
    const lower = url.toLowerCase();
    if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "video";
    if (lower.includes("canva.com") || lower.includes("docs.google.com/presentation")) return "pptx";
    return "link";
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      const detectedType = detectFileType(f.name);
      if (!formData.title) {
        setFormData((prev) => ({
          ...prev,
          title: f.name.replace(/\.[^/.]+$/, ""),
          file_type: detectedType,
        }));
      }
    }
  };

  const handleExternalLinkChange = (value) => {
    setFormData((prev) => ({
      ...prev,
      external_link: value,
      file_type: value.trim() ? detectLinkType(value) : prev.file_type,
    }));
  };

  const canSave =
    formData.title &&
    formData.course_id &&
    (sourceMode === "file" ? Boolean(file) : Boolean(formData.external_link.trim()));

  const handleSave = async () => {
    if (!canSave) {
      setSaveError("Заполните обязательные поля");
      return;
    }

    setSaveError(null);
    setSaving(true);
    try {
      let fileUrl = null;
      if (sourceMode === "file" && file) {
        const uploadedFile = await api.uploads.uploadFile({ file });
        fileUrl = uploadedFile.file_url;
      }

      const externalLink = sourceMode === "link" ? formData.external_link.trim() : null;

      await api.entities.LessonMaterial.create({
        title: formData.title,
        description: formData.description || "",
        notes: formData.notes || "",
        course_id: formData.course_id,
        folder_id: formData.folder_id || null,
        block_name: formData.block_name || "",
        file_type: formData.file_type,
        file_url: fileUrl,
        external_link: externalLink,
        tags: [],
      });

      onSave();
    } catch (err) {
      console.error("Save error:", err);
      setSaveError(getErrorMessage(err));
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
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border sticky top-0 bg-card z-10">
          <h2 className="text-lg font-bold text-foreground">Добавить материал</h2>
          <button onClick={onClose} className="p-2 hover:bg-muted rounded-lg transition-colors">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {saveError && (
            <div className="p-4 rounded-lg border border-destructive/50 bg-destructive/5 space-y-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <p className="text-sm text-destructive">{saveError}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={dismissSaveError}
                className="w-full"
              >
                OK
              </Button>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setSourceMode("file")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                sourceMode === "file"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              <Upload className="h-4 w-4" /> Файл
            </button>
            <button
              type="button"
              onClick={() => setSourceMode("link")}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                sourceMode === "link"
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-background text-foreground border-border hover:bg-muted"
              }`}
            >
              <Link2 className="h-4 w-4" /> Ссылка
            </button>
          </div>

          {sourceMode === "file" ? (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Файл *</label>
              <label className="flex items-center justify-center w-full p-4 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-indigo-400 transition-colors">
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
          ) : (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Внешняя ссылка *</label>
              <Input
                value={formData.external_link}
                onChange={(e) => handleExternalLinkChange(e.target.value)}
                placeholder="YouTube, Canva, Google Slides..."
              />
              <p className="text-xs text-muted-foreground mt-1">
                Поддерживаются YouTube, Canva, Google Slides и любые внешние ресурсы
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Название *</label>
            <Input
              value={formData.title}
              onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
              placeholder="Название материала"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Описание</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              placeholder="Краткое описание для учеников"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
              rows="2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Заметки (внутренние)</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
              placeholder="Заметки для администраторов и преподавателей"
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
              rows="2"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Курс *</label>
            <select
              value={formData.course_id}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, course_id: e.target.value, folder_id: "" }))
              }
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
            >
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.course_name || c.course_type}
                </option>
              ))}
            </select>
          </div>

          {folders.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">Папка</label>
              <select
                value={formData.folder_id}
                onChange={(e) => setFormData((prev) => ({ ...prev, folder_id: e.target.value }))}
                className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
              >
                <option value="">Корень курса</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Блок/Раздел</label>
            <Input
              value={formData.block_name}
              onChange={(e) => setFormData((prev) => ({ ...prev, block_name: e.target.value }))}
              placeholder="Например: Блок 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-2">Тип файла</label>
            <select
              value={formData.file_type}
              onChange={(e) => setFormData((prev) => ({ ...prev, file_type: e.target.value }))}
              className="w-full px-3 py-2 border border-input rounded-lg text-sm bg-background text-foreground"
            >
              <option value="pdf">PDF</option>
              <option value="pptx">PowerPoint / Презентация</option>
              <option value="video">Видео</option>
              <option value="link">Ссылка</option>
              <option value="other">Другое</option>
            </select>
          </div>
        </div>

        <div className="flex gap-3 p-6 border-t border-border sticky bottom-0 bg-card">
          <Button variant="outline" onClick={onClose} disabled={saving} className="flex-1">
            Отмена
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !canSave}
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
