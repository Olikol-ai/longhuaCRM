import React, { useEffect, useRef, useState } from 'react';
import { api } from '@/api';
import { AlertCircle, File, Link2, Loader2, Upload, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Caption } from '@/design-system';
import {
  CANVA_ACCESS_NOTICE,
  detectFileType,
  detectLinkType,
  isCanvaUrlString,
  isLinkMaterial,
  packMaterialDescription,
  unpackMaterialDescription,
} from '@/lib/materialMeta';
import {
  MATERIALS_FILE_ACCEPT,
  MATERIALS_MAX_UPLOAD_BYTES,
  formatBytes,
  formatMaterialsMaxLabel,
  formatUploadSpeed,
  probeMediaDurationSeconds,
} from '@/lib/materialUpload';
import { TUTOR_LIBRARY_COURSE_ID, isTutorLibraryCourseId } from '@/lib/tutorMaterials';

function getErrorMessage(err) {
  if (err?.aborted) return 'Загрузка отменена';
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
  const [uploadProgress, setUploadProgress] = useState(null);
  const abortRef = useRef(null);

  useEffect(() => {
    if (!form.course_id) {
      setCourseFolders([]);
      return;
    }
    const list = folders.filter((f) => f.course_id === form.course_id
      || (isTutorLibraryCourseId(form.course_id) && !f.course_id));
    setCourseFolders(list);
  }, [form.course_id, folders]);

  useEffect(() => () => {
    abortRef.current?.abort();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const resolveFolderId = async (courseId, preferredFolderId) => {
    if (preferredFolderId) return preferredFolderId;
    const rows = folders.filter((f) => f.course_id === courseId
      || (isTutorLibraryCourseId(courseId) && !f.course_id));
    const root = rows.find((f) => !(f.parent_id || f.parent_folder_id)) ?? rows[0];
    if (root?.id) return root.id;
    const payload = isTutorLibraryCourseId(courseId)
      ? { name: 'Корень', sort_order: 0 }
      : { course_id: courseId, name: 'Корень', sort_order: 0 };
    const created = await api.materials.folders.create(payload);
    return created.id;
  };

  const canSave =
    Boolean(form.title.trim()) &&
    Boolean(form.course_id || courses[0]?.id === TUTOR_LIBRARY_COURSE_ID) &&
    (editing
      ? sourceMode === 'link'
        ? Boolean(form.external_link.trim())
        : true
      : sourceMode === 'file'
        ? Boolean(file)
        : Boolean(form.external_link.trim()));

  const uploadSelectedFile = async () => {
    const controller = new AbortController();
    abortRef.current = controller;
    setUploadProgress({ percent: 0, loaded: 0, total: file.size, bytesPerSecond: 0 });

    const uploaded = await api.uploads.uploadFile({
      file,
      signal: controller.signal,
      onProgress: (progress) => setUploadProgress(progress),
    });
    if (!uploaded.file_url) throw new Error('Сервер не вернул URL файла');

    const durationSeconds = await probeMediaDurationSeconds(file);
    return {
      file_url: uploaded.file_url,
      file_type: uploaded.file_type || detectFileType(file.name),
      mime_type: uploaded.mime_type || file.type || null,
      file_size_bytes: uploaded.size_bytes ?? file.size,
      original_filename: uploaded.original_name || file.name,
      stored_filename: uploaded.stored_name || null,
      duration_seconds: durationSeconds,
    };
  };

  const handleSave = async () => {
    if (!canSave) {
      setError('Заполните обязательные поля');
      return;
    }
    if (sourceMode === 'file' && file && file.size > MATERIALS_MAX_UPLOAD_BYTES) {
      setError(`Размер файла не должен превышать ${formatMaterialsMaxLabel()}`);
      return;
    }
    setError(null);
    setSaving(true);
    setUploadProgress(null);
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
          Object.assign(payload, await uploadSelectedFile());
        }
        await api.materials.update(material.id, payload);
      } else if (sourceMode === 'file') {
        const uploadedMeta = await uploadSelectedFile();
        await api.materials.create({
          title: form.title.trim(),
          description,
          folder_id: folderId,
          ...uploadedMeta,
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
      abortRef.current = null;
      setSaving(false);
      setUploadProgress(null);
    }
  };

  const handleCancelUpload = () => {
    abortRef.current?.abort();
  };

  const onFilePick = (e) => {
    const next = e.target.files?.[0];
    if (!next) return;
    if (next.size > MATERIALS_MAX_UPLOAD_BYTES) {
      setError(`Размер файла не должен превышать ${formatMaterialsMaxLabel()}`);
      setFile(null);
      return;
    }
    setError(null);
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
          <button type="button" onClick={onClose} className="p-2 rounded-lg hover:bg-muted" disabled={saving}>
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
                disabled={saving}
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
                disabled={saving}
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
                  <span className="flex flex-col items-center gap-1 text-sm text-center">
                    <span className="flex items-center gap-2">
                      <File className="h-4 w-4" />
                      {file.name}
                    </span>
                    <span className="text-xs text-muted-foreground">{formatBytes(file.size)}</span>
                  </span>
                ) : (
                  <span className="flex flex-col items-center gap-1 text-sm text-muted-foreground text-center">
                    <span className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      {editing ? 'Заменить файл (необязательно)' : 'Выберите файл'}
                    </span>
                    <span className="text-xs">
                      PDF, Office, аудио, видео, изображения, ZIP — до {formatMaterialsMaxLabel()}
                    </span>
                  </span>
                )}
                <input
                  type="file"
                  className="hidden"
                  accept={MATERIALS_FILE_ACCEPT}
                  disabled={saving}
                  onChange={onFilePick}
                />
              </label>

              {uploadProgress ? (
                <div className="mt-3 space-y-2 rounded-xl border border-border bg-muted/30 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>Загрузка файла… {uploadProgress.percent}%</span>
                    <span>
                      {formatBytes(uploadProgress.loaded)}
                      {uploadProgress.total ? ` / ${formatBytes(uploadProgress.total)}` : ''}
                      {uploadProgress.bytesPerSecond
                        ? ` · ${formatUploadSpeed(uploadProgress.bytesPerSecond)}`
                        : ''}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width] duration-150"
                      style={{ width: `${uploadProgress.percent}%` }}
                    />
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={handleCancelUpload}
                  >
                    Отменить загрузку
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium mb-2">Ссылка *</label>
              <input
                value={form.external_link}
                onChange={(e) => setField('external_link', e.target.value)}
                placeholder="https://..."
                disabled={saving}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
              />
              {isCanvaUrlString(form.external_link) ? (
                <Caption className="mt-2 text-muted-foreground">
                  {CANVA_ACCESS_NOTICE} Longhua не делает ссылку публичной и не обходит права Canva.
                </Caption>
              ) : null}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium mb-2">Название *</label>
            <input
              value={form.title}
              onChange={(e) => setField('title', e.target.value)}
              disabled={saving}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Описание</label>
            <textarea
              value={form.description}
              onChange={(e) => setField('description', e.target.value)}
              rows={2}
              placeholder="Видят ученики"
              disabled={saving}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium mb-2">Курс *</label>
              <select
                value={form.course_id}
                onChange={(e) => setForm((prev) => ({ ...prev, course_id: e.target.value, folder_id: '' }))}
                disabled={saving}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
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
                disabled={saving}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
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
              disabled={saving}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
            />
          </div>

          <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
            <p className="text-sm font-medium text-foreground">Внутренние заметки</p>
            <p className="text-xs text-muted-foreground">Только для администраторов и преподавателей</p>
            <textarea
              value={form.notes}
              onChange={(e) => setField('notes', e.target.value)}
              rows={2}
              disabled={saving}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm min-h-touch"
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
                {uploadProgress ? `Загрузка ${uploadProgress.percent}%` : 'Сохранение...'}
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
