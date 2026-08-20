import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { openMaterial } from '@/lib/materialUrl';
import { toast } from '@/components/ui/use-toast';
import { Button } from '@/components/ui/button';
import {
  ArrowLeft,
  Loader2,
  Lock,
  Plus,
  Users,
} from 'lucide-react';
import AccessManager from './AccessManager';
import AccessManagementPanel from './AccessManagementPanel';
import FolderTree from './FolderTree';
import GrantAccessModal from './GrantAccessModal';
import MaterialBrowseToolbar from './MaterialBrowseToolbar';
import MaterialDialog from './MaterialDialog';
import MaterialMediaPreview from './MaterialMediaPreview';
import MaterialTable from './MaterialTable';
import { TUTOR_LIBRARY_COURSE_ID, isTutorLibraryCourseId } from '@/lib/tutorMaterials';
import { isInAppMediaMaterial } from '@/lib/materialMeta';
import {
  browseMaterials,
  collectMaterialBlocks,
  hasActiveMaterialBrowseFilters,
  loadMaterialBrowseState,
  saveMaterialBrowseState,
} from '@/lib/materialBrowse';
import { OfflineSnapshotBanner } from '@/components/pwa/OfflineSnapshotBanner';
import {
  OFFLINE_RESOURCES,
  readWithOfflineFallback,
  sanitizeMaterialMetaList,
} from '@/lib/offline';

function MaterialsSkeleton() {
  return (
    <div className="animate-pulse space-y-4" data-testid="materials-skeleton">
      <div className="h-8 w-64 rounded bg-muted" />
      <div className="h-4 w-96 max-w-full rounded bg-muted" />
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="w-full lg:w-72 space-y-2 rounded-xl border border-border p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded bg-muted" />
          ))}
        </div>
        <div className="flex-1 space-y-2 rounded-xl border border-border p-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-muted" />
          ))}
        </div>
      </div>
    </div>
  );
}

export default function MaterialManager() {
  const { user, isLoadingAuth } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [folders, setFolders] = useState([]);
  const [treeLoading, setTreeLoading] = useState(true);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterBlock, setFilterBlock] = useState('all');
  const [sort, setSort] = useState('newest');
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [selectedFolderId, setSelectedFolderId] = useState(null);
  const [browseHydrated, setBrowseHydrated] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [view, setView] = useState('library'); // library | users-access
  const [dialog, setDialog] = useState(null); // { mode, material?, courseId?, folderId? }
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [accessMaterial, setAccessMaterial] = useState(null);
  const [showGrant, setShowGrant] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [offlineMeta, setOfflineMeta] = useState({ fromCache: false, updatedAt: null, missing: false });
  const materialsRequestId = useRef(0);
  const courseInitialized = useRef(false);

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

  const mapFolders = useCallback((flds, courseList) => {
    const activeCourseIds = new Set(courseList.map((c) => c.id).filter(Boolean));
    return (Array.isArray(flds) ? flds : [])
      .filter((f) => {
        if (isTutor) return !f.course_id;
        return !f.course_id || activeCourseIds.has(f.course_id);
      })
      .map((f) => (
        isTutor
          ? { ...f, course_id: f.course_id || TUTOR_LIBRARY_COURSE_ID }
          : f
      ));
  }, [isTutor]);

  const mapMaterials = useCallback((mats) => (
    (Array.isArray(mats) ? mats : [])
      .filter((m) => m.status !== 'deleted')
      .map((m) => (
        isTutor
          ? { ...m, course_id: m.course_id || TUTOR_LIBRARY_COURSE_ID }
          : m
      ))
  ), [isTutor]);

  /** Tree + courses first — unlock UI without waiting for the full materials list. */
  const loadTree = useCallback(async () => {
    if (!user?.id) return;
    setLoadError(null);
    setTreeLoading(true);
    try {
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'unknown',
        resource: OFFLINE_RESOURCES.MATERIALS,
        resourceKey: isTutor ? 'tree_tutor' : 'tree_library',
        fetcher: async () => {
          const requests = [api.materials.folders.list()];
          if (!isTutor) {
            requests.unshift(api.courses.list());
          }
          const results = await Promise.all(requests);
          const courseList = isTutor
            ? [{ id: TUTOR_LIBRARY_COURSE_ID, name: 'Мои материалы', sort_order: 0 }]
            : (Array.isArray(results[0]) ? results[0] : []);
          const flds = isTutor ? results[0] : results[1];
          return {
            courses: courseList,
            folders: flds,
          };
        },
      });
      setOfflineMeta({
        fromCache: result.fromCache,
        updatedAt: result.updatedAt,
        missing: result.missing,
      });
      const courseList = result.data?.courses || [];
      const flds = result.data?.folders || [];
      setCourses(courseList);
      setFolders(mapFolders(flds, courseList));

      if (isTutor) {
        setSelectedCourseId((prev) => prev || TUTOR_LIBRARY_COURSE_ID);
        courseInitialized.current = true;
      } else if (!courseInitialized.current && courseList.length > 0) {
        setSelectedCourseId((prev) => prev || courseList[0].id);
        courseInitialized.current = true;
      }
      if (result.missing) {
        setLoadError('Материалы пока недоступны без подключения');
      }
    } catch (err) {
      setCourses([]);
      setFolders([]);
      setLoadError(err?.message || 'Не удалось загрузить дерево материалов');
    } finally {
      setTreeLoading(false);
    }
  }, [user, isTutor, mapFolders]);

  /**
   * Materials list — scoped by selected course/folder when possible.
   * Does not download file bytes; open/download is on-demand only.
   */
  const loadMaterials = useCallback(async (courseId, folderId) => {
    if (!user?.id) return;
    const reqId = ++materialsRequestId.current;
    setMaterialsLoading(true);
    setLoadError(null);
    try {
      const scope = {};
      if (courseId && !isTutorLibraryCourseId(courseId)) {
        scope.courseId = courseId;
      }
      if (folderId) {
        scope.folderId = folderId;
      }
      const resourceKey = `list:${scope.courseId || 'all'}:${scope.folderId || 'root'}`;
      const result = await readWithOfflineFallback({
        userId: user.id,
        role: user.role || 'unknown',
        resource: OFFLINE_RESOURCES.MATERIALS,
        resourceKey,
        fetcher: async () => {
          const mats = await api.materials.list('-created_date', undefined, scope);
          return { materials: sanitizeMaterialMetaList(mats) };
        },
      });
      if (reqId !== materialsRequestId.current) return;
      setOfflineMeta((prev) => ({
        fromCache: result.fromCache || prev.fromCache,
        updatedAt: result.updatedAt || prev.updatedAt,
        missing: result.missing,
      }));
      setMaterials(mapMaterials(result.data?.materials || []));
      if (result.missing) {
        setLoadError('Материалы пока недоступны без подключения');
      }
    } catch (err) {
      if (reqId !== materialsRequestId.current) return;
      setMaterials([]);
      setLoadError(err?.message || 'Не удалось загрузить материалы');
    } finally {
      if (reqId === materialsRequestId.current) {
        setMaterialsLoading(false);
      }
    }
  }, [user, mapMaterials]);

  const loadData = useCallback(async () => {
    await loadTree();
  }, [loadTree]);

  useEffect(() => {
    if (isLoadingAuth || !user?.id || browseHydrated) return;
    const saved = loadMaterialBrowseState(user.id, isTutor ? 'tutor' : 'library');
    if (saved) {
      if (typeof saved.search === 'string') setSearch(saved.search);
      if (typeof saved.filterType === 'string') setFilterType(saved.filterType);
      if (typeof saved.filterBlock === 'string') setFilterBlock(saved.filterBlock);
      if (typeof saved.sort === 'string') setSort(saved.sort);
      if (saved.selectedCourseId) {
        setSelectedCourseId(saved.selectedCourseId);
        courseInitialized.current = true;
      }
      if (saved.selectedFolderId !== undefined) {
        setSelectedFolderId(saved.selectedFolderId || null);
      }
    }
    setBrowseHydrated(true);
  }, [user?.id, isLoadingAuth, isTutor, browseHydrated]);

  useEffect(() => {
    if (!user?.id || !browseHydrated) return;
    saveMaterialBrowseState(user.id, isTutor ? 'tutor' : 'library', {
      search,
      filterType,
      filterBlock,
      sort,
      selectedCourseId,
      selectedFolderId,
    });
  }, [
    user?.id,
    browseHydrated,
    isTutor,
    search,
    filterType,
    filterBlock,
    sort,
    selectedCourseId,
    selectedFolderId,
  ]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setTreeLoading(false);
      setMaterialsLoading(false);
      return;
    }
    void loadTree();
  }, [user?.id, isLoadingAuth, loadTree]);

  // After tree is ready (and when course/folder selection changes), load materials lazily.
  useEffect(() => {
    if (isLoadingAuth || !user || treeLoading) return;
    // Wait until default course is chosen so the first fetch is scoped.
    if (!isTutor && courses.length > 0 && !courseInitialized.current) return;
    void loadMaterials(selectedCourseId, selectedFolderId);
  }, [
    user?.id,
    isLoadingAuth,
    treeLoading,
    isTutor,
    courses.length,
    selectedCourseId,
    selectedFolderId,
    loadMaterials,
  ]);

  const filtered = useMemo(() => {
    const scoped = materials.filter((m) => {
      if (selectedCourseId && m.course_id !== selectedCourseId) return false;
      if (selectedFolderId && m.folder_id !== selectedFolderId) return false;
      return true;
    });
    return browseMaterials(scoped, {
      search,
      typeFilter: filterType,
      blockFilter: filterBlock,
      sort,
    });
  }, [materials, search, selectedCourseId, selectedFolderId, filterType, filterBlock, sort]);

  const availableBlocks = useMemo(() => collectMaterialBlocks(materials), [materials]);

  const filtersActive = hasActiveMaterialBrowseFilters({
    search,
    typeFilter: filterType,
    blockFilter: filterBlock,
    sort,
  });

  const resetBrowseFilters = () => {
    setSearch('');
    setFilterType('all');
    setFilterBlock('all');
    setSort('newest');
  };

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
      await loadMaterials(selectedCourseId, selectedFolderId);
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
      await Promise.all([
        loadTree(),
        loadMaterials(target?.courseId || selectedCourseId, target?.folderId || null),
      ]);
    } catch (err) {
      toast({
        title: 'Не удалось переместить материалы',
        description: err?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    }
  };

  if (isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  if (treeLoading && courses.length === 0 && folders.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <MaterialsSkeleton />
      </div>
    );
  }

  if (loadError && courses.length === 0 && materials.length === 0) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto">
        <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center space-y-3">
          <h1 className="text-xl font-semibold text-foreground">Не удалось открыть материалы</h1>
          <p className="text-sm text-muted-foreground">{loadError}</p>
          <Button
            onClick={() => { void loadTree(); }}
            className="bg-primary hover:bg-primary/90"
          >
            Повторить
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-4">
      <OfflineSnapshotBanner
        fromCache={offlineMeta.fromCache}
        updatedAt={offlineMeta.updatedAt}
        missing={offlineMeta.missing}
        emptyLabel="Материалы пока недоступны без подключения"
      />
      {view === 'users-access' ? (
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setView('library')}
              className="mt-1 inline-flex items-center gap-1.5 min-h-10 px-2 rounded-lg text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Назад"
              data-testid="materials-access-back"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" aria-hidden />
              Назад
            </button>
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Материалы</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-foreground">
                Назначение доступа
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Выберите пользователя и настройте материалы, которые ему доступны
              </p>
            </div>
          </div>
          <AccessManagementPanel isAdmin={isAdmin} />
        </div>
      ) : (
        <>
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
              variant="outline"
              onClick={() => setView('users-access')}
              className="gap-2"
              data-testid="materials-open-user-access"
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

          <MaterialBrowseToolbar
            search={search}
            onSearchChange={setSearch}
            typeFilter={filterType}
            onTypeFilterChange={setFilterType}
            blockFilter={filterBlock}
            onBlockFilterChange={setFilterBlock}
            blocks={availableBlocks}
            sort={sort}
            onSortChange={setSort}
            showReset={filtersActive}
            onReset={resetBrowseFilters}
            extraFilters={(
              <>
                <select
                  value={selectedCourseId || ''}
                  onChange={(e) => {
                    const id = e.target.value || null;
                    setSelectedCourseId(id);
                    setSelectedFolderId(null);
                  }}
                  className="w-full min-w-0 min-h-touch rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-auto sm:min-w-[10rem]"
                  aria-label="Курс"
                >
                  {!isTutor && <option value="">Все курсы</option>}
                  {courses.map((c) => (
                    <option key={c.id} value={c.id}>{c.name || c.course_name || 'Курс'}</option>
                  ))}
                </select>
                <select
                  value={selectedFolderId || ''}
                  onChange={(e) => setSelectedFolderId(e.target.value || null)}
                  className="w-full min-w-0 min-h-touch rounded-lg border border-input bg-background px-3 py-2 text-sm sm:w-auto sm:min-w-[10rem]"
                  aria-label="Папка"
                  disabled={!selectedCourseId}
                >
                  <option value="">Все папки</option>
                  {folders
                    .filter((f) => f.course_id === selectedCourseId)
                    .map((f) => (
                      <option key={f.id} value={f.id}>{f.name}</option>
                    ))}
                </select>
              </>
            )}
          />

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
              onRefresh={async () => {
                await loadTree();
                await loadMaterials(selectedCourseId, selectedFolderId);
              }}
              onTreeRefresh={loadTree}
              onFolderRenamed={(folderId, name) => {
                setFolders((prev) =>
                  prev.map((folder) =>
                    folder.id === folderId ? { ...folder, name } : folder,
                  ),
                );
              }}
              canManage={canManageCourses}
              currentUserId={user?.id || null}
              canReceiveMaterials={canReceiveMaterials}
              onDropMaterials={moveMaterials}
            />
            <div className="flex-1 min-w-0 w-full relative">
              {materialsLoading && (
                <div className="absolute inset-0 z-10 flex items-start justify-center rounded-xl bg-background/60 pt-16">
                  <Loader2 className="h-6 w-6 animate-spin text-brand" />
                </div>
              )}
              <MaterialTable
                materials={filtered}
                courses={courses}
                folders={folders}
                selectedIds={selectedIds}
                emptyHint={
                  materials.length === 0
                    ? 'Измените курс или папку, либо добавьте материал'
                    : 'Попробуйте изменить поиск или фильтры'
                }
                onResetFilters={
                  filtersActive || materials.length > 0
                    ? resetBrowseFilters
                    : undefined
                }
                showResetFilters={filtersActive && filtered.length === 0 && materials.length > 0}
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
                    if (isInAppMediaMaterial(mat)) {
                      setPreviewMaterial(mat);
                      return;
                    }
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
            await loadTree();
            await loadMaterials(selectedCourseId, selectedFolderId);
          }}
        />
      )}

      {previewMaterial ? (
        <MaterialMediaPreview
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
        />
      ) : null}

      {accessMaterial && (
        <AccessManager
          material={accessMaterial}
          course={courses.find((c) => c.id === accessMaterial.course_id)}
          folders={folders}
          onClose={() => setAccessMaterial(null)}
          onSave={async () => {
            await loadMaterials(selectedCourseId, selectedFolderId);
          }}
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
            void loadMaterials(selectedCourseId, selectedFolderId);
          }}
        />
      )}
    </div>
  );
}
