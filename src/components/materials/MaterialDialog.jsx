import React, { useEffect, useState } from 'react';
import { api } from '@/api';
import { AlertCircle, File, Link2, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  detectFileType,
  detectLinkType,
  isLinkMaterial,
  packMaterialDescription,
  unpackMaterialDescription,
} from '@/lib/materialMeta';

function getErrorMessage(err) {
  return err?.data?.message || err?.message || 'Не удалось сохранить материал';
}

export default function MaterialDialog({
  mode = 'create',
  material = null,
  courses = [],
  folders = [],
  defaultCourseId = '',
  defaultFolderId = null,
  onClose,
  onSaved,
}) {
  const editing = mode === 'edit' && material;
  const initialMeta = unpackMaterialDescription(material?.description);

  const [sourceMode, setSourceMode] = useState(
    editing && isLinkMaterial(material) ? 'link' : 'file',
  );
  const [form, setForm] = useState({
    title: material?.title || '',
    description: initialMeta.description || '',
    notes: initialMeta.notes || '',
    course_id: material?.course_id || defaultCourseId || courses[0]?.id || '',
    folder_id: material?.folder_id || defaultFolderId || '',
    block_name: initialMeta.blockName || '',
    external_link:
      editing && isLinkMaterial(material)
        ? (material.external_link || material.file_url || '')
        : '',
  });
  const [file, setFile] = useState(null);
  const [courseFolders, setCourseFolders] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!form.course_id) {
      setCourseFolders([]);
      return;
    }
    const list = folders.filter((f) => f.course_id === form.course_id);
    setCourseFolders(list);
  }, [form.course_id, folders]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resolveFolderId = async (courseId, preferredFolderId) => {
    if (preferredFolderId) return preferredFolderId;
    const rows = folders.filter((f) => f.course_id === courseId);
    const root = rows.find((f) => !(f.parent_id || f.parent_folder_id)) ?? rows[0];
    if (root?.id) return root.id;
    const created = await api.materials.folders.create({
      course_id: courseId,
      name: 'Корень',
      sort_order: 0,
    });
    return created.id;
  };

  const canSave =
    Boolean(form.title.trim()) &&
    Boolean(form.course_id) &&
    (editing
      ? sourceMode === 'link'
        ? Boolean(form.external_link.trim())
        : true
      : sourceMode === 'file'
        ? Boolean(file)
        : Boolean(form.external_link.trim()));

  const handleSave = async () => {
    if (!canSave) {
      setError('Заполните обязательные поля');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const folderId = await resolveFolderId(form.course_id, form.folder_id || null);
      const description = packMaterialDescription({
        description: form.description,
        notes: form.notes,
        blockName: form.block_name,
      });

      if (editing) {
        const payload = {
          title: form.title.trim(),
          description,
          folder_id: folderId,
        };
        if (sourceMode === 'link') {
          const link = form.external_link.trim();
          payload.file_url = link;
          payload.file_type = detectLinkType(link);
        } else if (file) {
          const uploaded = await api.uploads.uploadFile({ file });
          if (!uploaded.file_url) throw new Error('Сервер не вернул URL файла');
          payload.file_url = uploaded.file_url;
          payload.file_type = detectFileType(file.name);
        }
        await api.materials.update(material.id, payload);
      } else if (sourceMode === 'file') {
        const uploaded = await api.uploads.uploadFile({ file });
        if (!uploaded.file_url) throw new Error('Сервер не вернул URL файла');
        await api.materials.create({
          title: form.title.trim(),
          description,
          folder_id: folderId,
          file_type: detectFileType(file.name),
          file_url: uploaded.file_url,
        });
      } else {
        const link = form.external_link.trim();
        await api.materials.create({
          title: form.title.trim(),
          description,
          folder_id: folderId,
          file_type: detectLinkType(link),
          file_url: link,
        });
      }

      onSaved?.();
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const onFilePick = (e) => {
    const next = e.target.files?.[0];
    if (!next) return;
    setFile(next);
    if (!form.title) {
      setField('title', next.name.replace(/\.[^/.]+$/, ''));
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg max-h-[92vh] overflow-y-auto rounded-2xl bg-card border border-border shadow-xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-card px-5 py-4">
          <h2 className="text-lg font-semibold text-foreground">
            {editing ? 'Редактировать материал' : 'Добавить материал'}
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted">
            <X className="h-5 w-5 text-muted-foreground" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4">
          {error && (
            <div className="flex gap-2 rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-foreground mb-2">Тип материала</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceMode('file')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  sourceMode === 'file'
                    ? 'bg-primary text-primary-foreground border-brand'
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                <Upload className="h-4 w-4" />
                Файл
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('link')}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  sourceMode === 'link'
                    ? 'bg-primary text-primary-foreground border-brand'
                    : 'bg-background border-border hover:bg-muted'
                }`}
              >
                <Link2 className="h-4 w-4" />
                Ссылка
              </button>
            </div>
          </div>

          {sourceMode === 'file' ? (
            <div>
              <label className="block text-sm font-medium mb-2">
                Файл {!editing && '*'}
              </label>
              <label className="flex cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-border p-5 hover:border-brand/40 transition-colors">
                {file ? (
                  <span className="flex items-center gap-2 text-sm">
                    <File className="h-4 w-4" />
                    {file.name}
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Upload className="h-4 w-4" />
                    {editing ? 'Заменить файл (необязательно)' : 'Выберите файл'}
                  </span>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.pptx,.ppt,.mp4,.webm,.mov,.3gp,.jpg,.jpeg,.png"
                  onChange={onFilePick}
                />
              </label>
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Ссылка *</label>
              <input
                value={form.external_link}
                onChange={(e) => setField('external_link', e.target.value)}
                placeholder="https://..."
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Название *</label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
              placeholder="Видят ученики"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Курс *</label>
              <select
                value={form.course_id}
                onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value, folder_id: '' }))}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || c.course_name || 'Курс'}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-2">Папка</label>
              <select
                value={form.folder_id}
                onChange={(e) => setField('folder_id', e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="">Корень курса</option>
                {courseFolders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Раздел / блок</label>
            <input
              value={form.block_name}
              onChange={(e) => setField('block_name', e.target.value)}
              placeholder="Например: Грамматика"
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Внутренние заметки</p>
            <p className="text-xs text-muted-foreground">Только для администраторов и преподавателей</p>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-card px-5 py-4">
          <Button variant="outline" className="flex-1" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button
            className="flex-1 bg-primary hover:bg-primary/90"
            onClick={handleSave}
            disabled={saving || !canSave}
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                Сохранение...
              </>
            ) : editing ? (
              'Сохранить'
            ) : (
              'Создать'
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
