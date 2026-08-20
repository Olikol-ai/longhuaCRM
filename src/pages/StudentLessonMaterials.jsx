import { useState, useEffect, useMemo } from 'react';
import { api } from '@/api';
import { useAuth } from '@/lib/AuthContext';
import { Card } from '@/components/ui/card';
import { Loader2, BookOpen, ExternalLink } from 'lucide-react';
import { openMaterial } from '@/lib/materialUrl';
import { toast } from '@/components/ui/use-toast';
import { getMaterialTypeInfo } from '@/lib/materialIcons';
import {
  isInAppMediaMaterial,
  publicMaterialDescription,
  resolveMaterialDisplayTitle,
  unpackMaterialDescription,
} from '@/lib/materialMeta';
import {
  browseMaterials,
  collectMaterialBlocks,
  hasActiveMaterialBrowseFilters,
  loadMaterialBrowseState,
  saveMaterialBrowseState,
} from '@/lib/materialBrowse';
import AccessSourceBadges from '@/components/materials/AccessSourceBadges';
import MaterialBrowseToolbar from '@/components/materials/MaterialBrowseToolbar';
import MaterialMediaPreview from '@/components/materials/MaterialMediaPreview';
import { Button } from '@/components/ui/button';

export default function StudentLessonMaterials() {
  const { user, isLoadingAuth } = useAuth();
  const [materials, setMaterials] = useState([]);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('all');
  const [filterBlock, setFilterBlock] = useState('all');
  const [sort, setSort] = useState('newest');
  const [error, setError] = useState('');
  const [previewMaterial, setPreviewMaterial] = useState(null);
  const [browseHydrated, setBrowseHydrated] = useState(false);

  useEffect(() => {
    if (isLoadingAuth || !user?.id || browseHydrated) return;
    const saved = loadMaterialBrowseState(user.id, 'student');
    if (saved) {
      if (typeof saved.search === 'string') setSearch(saved.search);
      if (typeof saved.filterType === 'string') setFilterType(saved.filterType);
      if (typeof saved.filterBlock === 'string') setFilterBlock(saved.filterBlock);
      if (typeof saved.sort === 'string') setSort(saved.sort);
    }
    setBrowseHydrated(true);
  }, [user?.id, isLoadingAuth, browseHydrated]);

  useEffect(() => {
    if (!user?.id || !browseHydrated) return;
    saveMaterialBrowseState(user.id, 'student', {
      search,
      filterType,
      filterBlock,
      sort,
    });
  }, [user?.id, browseHydrated, search, filterType, filterBlock, sort]);

  useEffect(() => {
    if (isLoadingAuth) return;
    if (!user) {
      setLoading(false);
      return;
    }
    loadData();
  }, [user?.id, isLoadingAuth]);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const [matsResult, coursesResult] = await Promise.allSettled([
        api.materials.list('-created_date', 500),
        api.courses.list(),
      ]);

      if (matsResult.status === 'fulfilled') {
        setMaterials(Array.isArray(matsResult.value) ? matsResult.value : []);
      } else {
        setMaterials([]);
        setError(matsResult.reason?.message || 'Не удалось загрузить материалы');
      }

      if (coursesResult.status === 'fulfilled') {
        setCourses(Array.isArray(coursesResult.value) ? coursesResult.value : []);
      } else {
        setCourses([]);
      }
    } catch (err) {
      setMaterials([]);
      setCourses([]);
      setError(err.message || 'Не удалось загрузить материалы');
    } finally {
      setLoading(false);
    }
  };

  const filtered = useMemo(
    () =>
      browseMaterials(materials, {
        search,
        typeFilter: filterType,
        blockFilter: filterBlock,
        sort,
      }),
    [materials, search, filterType, filterBlock, sort],
  );

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

  if (loading || isLoadingAuth) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-brand" />
      </div>
    );
  }

  const courseNameById = new Map(courses.map((c) => [c.id, c.name || c.course_name || 'Курс']));

  const grouped = filtered.reduce((acc, mat) => {
    const key = mat.course_id || 'other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(mat);
    return acc;
  }, {});

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto" data-testid="student-materials-page">
      <div className="mb-6 space-y-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Мои материалы</h1>
          <p className="text-sm text-muted-foreground mt-2">
            Материалы, к которым вам предоставлен доступ
          </p>
        </div>
        {materials.length > 0 || filtersActive ? (
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
          />
        ) : null}
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-400 text-sm px-4 py-3 space-y-2">
          <p>{error}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void loadData()}>
            Повторить
          </Button>
        </div>
      )}

      {filtered.length === 0 ? (
        <Card className="p-16 text-center border-dashed space-y-3" data-testid="student-materials-empty">
          <BookOpen className="h-12 w-12 text-muted-foreground mx-auto" />
          <p className="text-foreground font-medium">Материалы не найдены</p>
          <p className="text-sm text-muted-foreground">
            {materials.length === 0 && !filtersActive
              ? 'Пока нет доступных материалов'
              : 'Попробуйте изменить поиск или фильтры'}
          </p>
          {filtersActive ? (
            <Button type="button" variant="outline" onClick={resetBrowseFilters}>
              Сбросить фильтры
            </Button>
          ) : null}
        </Card>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([courseId, courseMats]) => (
            <div key={courseId}>
              <h2 className="text-sm font-semibold text-foreground mb-3">
                {courseId === 'other' ? 'Без курса' : courseNameById.get(courseId) || 'Курс'}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {courseMats.map((mat) => {
                  const typeInfo = getMaterialTypeInfo(mat);
                  const IconComp = typeInfo.icon;
                  const meta = unpackMaterialDescription(mat.description);
                  const description = publicMaterialDescription(mat.description);
                  const displayTitle = resolveMaterialDisplayTitle(mat);
                  return (
                    <button
                      key={mat.id}
                      type="button"
                      className="text-left w-full min-w-0"
                      data-testid={`student-material-${mat.id}`}
                      title={displayTitle}
                      onClick={async () => {
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
                    >
                      <Card className="p-4 hover:shadow-lg transition-all cursor-pointer hover:border-brand/40 dark:hover:border-brand/40 h-full flex flex-col min-w-0 overflow-hidden">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div className={`h-10 w-10 rounded-lg ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                            <IconComp className={`h-5 w-5 ${typeInfo.color}`} />
                          </div>
                          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
                        </div>
                        <p
                          className="text-sm font-semibold text-foreground line-clamp-2 break-words mb-1"
                          data-testid={`material-title-${mat.id}`}
                        >
                          {displayTitle}
                        </p>
                        {meta.blockName && (
                          <p className="text-xs text-muted-foreground mb-1 truncate">{meta.blockName}</p>
                        )}
                        {description && (
                          <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{description}</p>
                        )}
                        <AccessSourceBadges sources={mat.access_sources} className="mt-auto pt-2" />
                      </Card>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {previewMaterial ? (
        <MaterialMediaPreview
          material={previewMaterial}
          onClose={() => setPreviewMaterial(null)}
        />
      ) : null}
    </div>
  );
}
