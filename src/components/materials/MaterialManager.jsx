import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { openMaterial, downloadMaterialFile } from '@/lib/materialUrl';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Loader2,
  Lock,
  Plus,
  Search,
  Users,
} from 'lucide-react';
import AccessManager from './AccessManager';
import AccessManagementPanel from './AccessManagementPanel';
import FolderTree from './FolderTree';
import GrantAccessModal from './GrantAccessModal';
import MaterialDialog from './MaterialDialog';
import MaterialTable from './MaterialTable';
import { TUTOR_LIBRARY_COURSE_ID, isTutorLibraryCourseId } from '@/lib/tutorMaterials';

export default function MaterialManager() {
  const { user, isLoadingAuth } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [folders, setFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [view, setView] = useState('library'); // library | users-access
  const [dialog, setDialog] = useState(null); // { mode, material?, courseId?, folderId? }
  const [accessMaterial, setAccessMaterial] = useState(null);
  const [showGrant, setShowGrant] = useState(false);
  const [deletingId, setDeletingId] = useState(null);

  const isAdmin = user?.role === 'admin';
  const isTeacher = user?.role === 'teacher' || Boolean(user?.has_teacher_profile);
  const isTutor = user?.role === 'tutor';
  const canCreateMaterials = isAdmin || isTeacher || isTutor;
  const canManageCourses = isAdmin;
  const canAccess = isAdmin || isTeacher || isTutor;
  const canBulkUserAccess = isAdmin || isTeacher;
  const canEditMaterial = (mat) =>
    isAdmin || (Boolean(user?.id) && mat?.created_by_user_id === user.id);
  const canDragMaterials = canCreateMaterials;
  const canReceiveMaterials = canCreateMaterials;

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoadError(null);
    try {
      const requests = [
        api.materials.list('-created_date'),
        api.materials.folders.list(),
      ];
      if (!isTutor) {
        requests.splice(1, 0, api.courses.list());
      }
      const results = await Promise.all(requests);
      const mats = results[0];
      const crs = isTutor ? [] : results[1];
      const flds = isTutor ? results[1] : results[2];

      const courseList = isTutor
        ? [{ id: TUTOR_LIBRARY_COURSE_ID, name: 'Мои материалы', sort_order: 0 }]
        : (Array.isArray(crs) ? crs : []);
      const activeCourseIds = new Set(courseList.map((c) => c.id).filter(Boolean));

      const mappedFolders = (Array.isArray(flds) ? flds : [])
        .filter((f) => {
          if (isTutor) return !f.course_id;
          return !f.course_id || activeCourseIds.has(f.course_id);
        })
        .map((f) => (
          isTutor
            ? { ...f, course_id: f.course_id || TUTOR_LIBRARY_COURSE_ID }
            : f
        ));

      const mappedMaterials = (Array.isArray(mats) ? mats : [])
        .filter((m) => m.status !== 'deleted')
        .map((m) => (
          isTutor
            ? { ...m, course_id: m.course_id || TUTOR_LIBRARY_COURSE_ID }
            : m
        ));

      setMaterials(mappedMaterials);
      setCourses(courseList);
      setFolders(mappedFolders);
      if (isTutor) {
        setSelectedCourseId((prev) => prev || TUTOR_LIBRARY_COURSE_ID);
      }
    } catch (err) {
      setMaterials([]);
      setCourses([]);
      setFolders([]);
      setLoadError(err?.message || 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  }, [user, isTutor]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.id, isLoadingAuth, loadData]);

  const filtered = useMemo(() => {
    return materials.filter((m) => {
      const q = search.trim().toLowerCase();
      if (q && !(m.title || '').toLowerCase().includes(q) && !(m.description || '').toLowerCase().includes(q)) {
        return false;
      }
      if (selectedCourseId && m.course_id !== selectedCourseId) return false;
      if (selectedFolderId && m.folder_id !== selectedFolderId) return false;
      if (filterType !== 'all') {
        if (filterType === 'link') {
          if (m.file_type !== 'link' && !String(m.file_url || '').startsWith('http')) return false;
        } else if (m.file_type !== filterType) {
          return false;
        }
      }
      return true;
    });
  }, [materials, search, selectedCourseId, selectedFolderId, filterType]);

  const openCreate = () => {
    const courseId = selectedCourseId || courses[0]?.id || (isTutor ? TUTOR_LIBRARY_COURSE_ID : null);
    if (!courseId) {
      alert('Сначала создайте курс в меню слева («Создать курс»).');
      return;
    }
    setDialog({
      mode: 'create',
      courseId,
      folderId: selectedFolderId,
    });
  };

  const handleDelete = async (matId) => {
    if (!confirm('Удалить материал? Привязки к урокам останутся в истории.')) return;
    setDeletingId(matId);
    try {
      const result = await api.materials.delete(matId);
      await loadData();
      alert(
        result?.message
        || (result?.mode === 'soft'
          ? 'Материал скрыт. История привязок сохранена.'
          : 'Материал удалён.'),
      );
    } catch (err) {
      alert(err.message || 'Не удалось удалить материал');
    } finally {
      setDeletingId(null);
    }
  };

  const resolveFolderIdForMove = async (courseId, preferredFolderId) => {
    if (preferredFolderId) return preferredFolderId;
    if (!courseId) {
      throw new Error('Не выбран курс для переноса');
    }
    const rows = folders.filter((f) => f.course_id === courseId);
    const root = rows.find((f) => !(f.parent_id || f.parent_folder_id)) ?? rows[0];
    if (root?.id) return root.id;
    const payload = isTutorLibraryCourseId(courseId)
      ? { name: 'Корень', sort_order: 0 }
      : { course_id: courseId, name: 'Корень', sort_order: 0 };
    const created = await api.materials.folders.create(payload);
    return created.id;
  };

  const moveMaterials = async (ids, target) => {
    const idSet = new Set((ids || []).map(String));
    const movable = materials.filter((m) => idSet.has(String(m.id)) && canEditMaterial(m));
    if (movable.length === 0) {
      toast({
        title: 'Нечего перемещать',
        description: 'Можно переносить только материалы, которые вам разрешено редактировать.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const folderId = await resolveFolderIdForMove(target?.courseId, target?.folderId || null);
      const toMove = movable.filter((m) => String(m.folder_id) !== String(folderId));
      if (toMove.length === 0) {
        toast({ title: 'Материалы уже в этой папке' });
        return;
      }

      await Promise.all(
        toMove.map((m) => api.materials.update(m.id, { folder_id: folderId })),
      );

      toast({
        title: toMove.length === 1 ? 'Материал перемещён' : `Перемещено материалов: ${toMove.length}`,
      });
      setSelectedIds(new Set());
      if (target?.courseId) {
        setSelectedCourseId(target.courseId);
        setSelectedFolderId(target.folderId || null);
      }
      await loadData();
    } catch (err) {
      toast({
        title: 'Не удалось переместить материалы',
        description: err?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    }
  };

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Не удалось открыть материалы</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button onClick={() => { setLoading(true); loadData(); }} className="bg-primary hover:bg-primary/90">
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Материалы уроков</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isTutor
              ? 'Ваша личная библиотека файлов и ссылок для учеников'
              : 'Библиотека файлов и ссылок по курсам'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canBulkUserAccess && (
            <Button
              variant={view === 'users-access' ? 'default' : 'outline'}
              onClick={() => setView(view === 'users-access' ? 'library' : 'users-access')}
              className="gap-2"
            >
              <Users className="h-4 w-4" />
              Доступ пользователей
            </Button>
          )}
          {canCreateMaterials && (
            <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 gap-2">
              <Plus className="h-4 w-4" />
              Добавить материал
            </Button>
          )}
        </div>
      </div>

      {view === 'users-access' ? (
        <AccessManagementPanel isAdmin={isAdmin} />
      ) : (
        <>
          <div className="flex flex-col lg:flex-row gap-3 lg:items-center">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск..."
                className="pl-9"
              />
            </div>
            <select
              value={selectedCourseId || ''}
              onChange={(e) => {
                const id = e.target.value || null;
                setSelectedCourseId(id);
                setSelectedFolderId(null);
              }}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              {!isTutor && <option value="">Все курсы</option>}
              {courses.map((c) => (
                <option key={c.id} value={c.id}>{c.name || c.course_name || 'Курс'}</option>
              ))}
            </select>
            <select
              value={selectedFolderId || ''}
              onChange={(e) => setSelectedFolderId(e.target.value || null)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
              disabled={!selectedCourseId}
            >
              <option value="">Все папки</option>
              {folders
                .filter((f) => f.course_id === selectedCourseId)
                .map((f) => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
            </select>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="all">Все типы</option>
              <option value="pdf">PDF</option>
              <option value="pptx">Презентация</option>
              <option value="video">Видео</option>
              <option value="link">Ссылка</option>
              <option value="other">Файл</option>
            </select>
          </div>

          {selectedIds.size > 0 && canAccess && (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand/30 dark:border-brand/50 bg-brand-soft/50 dark:bg-brand-soft/30 px-4 py-3">
              <span className="text-sm text-brand-hover dark:text-brand">
                Выбрано: {selectedIds.size}
              </span>
              <div className="flex gap-2">
                <Button onClick={() => setShowGrant(true)} className="bg-primary hover:bg-primary/90 gap-2">
                  <Lock className="h-4 w-4" />
                  Предоставить доступ
                </Button>
                <Button variant="outline" onClick={() => setSelectedIds(new Set())}>Сбросить</Button>
              </div>
            </div>
          )}

          {/* Hidden tab control for Playwright: "Материалы" button */}
          <button type="button" className="sr-only" onClick={() => setView('library')}>
            Материалы
          </button>

          <div className="flex flex-col lg:flex-row gap-4 items-start">
            <FolderTree
              courses={courses}
              folders={folders}
              materials={materials}
              selectedCourseId={selectedCourseId}
              selectedFolderId={selectedFolderId}
              onSelectFolder={({ courseId, folderId }) => {
                setSelectedCourseId(courseId);
                setSelectedFolderId(folderId);
              }}
              onRefresh={loadData}
              canManage={canManageCourses}
              canReceiveMaterials={canReceiveMaterials}
              onDropMaterials={moveMaterials}
            />
            <div className="flex-1 min-w-0 w-full">
              <MaterialTable
                materials={filtered}
                courses={courses}
                folders={folders}
                selectedIds={selectedIds}
                onToggleSelect={(id) => {
                  setSelectedIds((prev) => {
                    const next = new Set(prev);
                    if (next.has(id)) next.delete(id);
                    else next.add(id);
                    return next;
                  });
                }}
                onSelectAll={(checked) => {
                  setSelectedIds(checked ? new Set(filtered.map((m) => m.id)) : new Set());
                }}
                canManage={canCreateMaterials}
                canEditMaterial={canEditMaterial}
                canAccess={canAccess}
                canDragMaterials={canDragMaterials}
                onOpen={async (mat) => {
                  try {
                    await openMaterial(mat);
                  } catch (err) {
                    toast({
                      title: 'Не удалось открыть материал',
                      description: err?.message || 'Попробуйте ещё раз',
                      variant: 'destructive',
                    });
                  }
                }}
                onEdit={(mat) => setDialog({ mode: 'edit', material: mat })}
                onAccess={(mat) => setAccessMaterial(mat)}
                onDelete={handleDelete}
                deletingId={deletingId}
              />
            </div>
          </div>
        </>
      )}

      {dialog && (
        <MaterialDialog
          mode={dialog.mode}
          material={dialog.material}
          courses={courses}
          folders={folders}
          defaultCourseId={dialog.courseId}
          defaultFolderId={dialog.folderId}
          onClose={() => setDialog(null)}
          onSaved={async () => {
            setDialog(null);
            await loadData();
          }}
        />
      )}

      {accessMaterial && (
        <AccessManager
          material={accessMaterial}
          course={courses.find((c) => c.id === accessMaterial.course_id)}
          folders={folders}
          onClose={() => setAccessMaterial(null)}
          onSave={loadData}
        />
      )}

      {showGrant && selectedIds.size > 0 && (
        <GrantAccessModal
          user={user}
          materialIds={Array.from(selectedIds)}
          onClose={() => setShowGrant(false)}
          onSuccess={() => {
            setShowGrant(false);
            setSelectedIds(new Set());
            loadData();
          }}
        />
      )}
    </div>
  );
}
