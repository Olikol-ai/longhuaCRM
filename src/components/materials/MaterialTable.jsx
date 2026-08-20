import React from 'react';
import {
  Download,
  ExternalLink,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
  Lock,
  Eye,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { getMaterialTypeInfo } from '@/lib/materialIcons';
import { downloadMaterialFile, openMaterial } from '@/lib/materialUrl';
import {
  isCanvaMaterial,
  isExternalLinkMaterial,
  resolveMaterialDisplayTitle,
  unpackMaterialDescription,
} from '@/lib/materialMeta';
import { setMaterialDragData } from '@/lib/materialDrag';
import { toast } from '@/components/ui/use-toast';
import AccessSourceBadges from './AccessSourceBadges';

function formatDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return '—';
  }
}

export default function MaterialTable({
  materials,
  courses,
  folders,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  canManage,
  canEditMaterial,
  canAccess,
  canDragMaterials = false,
  onOpen,
  onEdit,
  onAccess,
  onDelete,
  deletingId,
  emptyHint,
  showResetFilters = false,
  onResetFilters,
}) {
  const allSelected = materials.length > 0 && materials.every((m) => selectedIds.has(m.id));
  const mayEdit = (mat) =>
    typeof canEditMaterial === 'function' ? canEditMaterial(mat) : Boolean(canManage);

  const courseName = (courseId) => {
    const course = courses.find((c) => c.id === courseId);
    return course?.name || course?.course_name || '—';
  };

  const folderName = (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    return folder?.name || 'Без папки';
  };

  const resolveDragIds = (mat) => {
    if (selectedIds.has(mat.id) && selectedIds.size > 1) {
      return materials
        .filter((row) => selectedIds.has(row.id) && mayEdit(row))
        .map((row) => row.id);
    }
    return mayEdit(mat) ? [mat.id] : [];
  };

  const handleOpen = async (mat) => {
    try {
      if (onOpen) {
        await onOpen(mat);
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
  };

  const handleDownload = async (mat) => {
    try {
      await downloadMaterialFile(mat, resolveMaterialDisplayTitle(mat));
    } catch (err) {
      toast({
        title: 'Не удалось скачать',
        description: err?.message || 'Попробуйте ещё раз',
        variant: 'destructive',
      });
    }
  };

  if (materials.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl bg-card gap-3"
        data-testid="admin-materials-empty"
      >
        <p className="text-sm font-medium text-muted-foreground">Материалы не найдены</p>
        {emptyHint ? (
          <p className="text-xs text-muted-foreground text-center">{emptyHint}</p>
        ) : null}
        {showResetFilters && onResetFilters ? (
          <button
            type="button"
            onClick={onResetFilters}
            className="inline-flex items-center px-3 py-2 min-h-touch text-sm rounded-lg border border-border hover:bg-brand-soft hover:text-brand"
          >
            Сбросить фильтры
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      {/* Mobile cards */}
      <div className="lg:hidden divide-y divide-border">
        {materials.map((mat) => {
          const typeInfo = getMaterialTypeInfo(mat);
          const Icon = typeInfo.icon;
          const selected = selectedIds.has(mat.id);
          const displayTitle = resolveMaterialDisplayTitle(mat);
          const externalLink = isExternalLinkMaterial(mat) || isCanvaMaterial(mat);
          return (
            <div key={mat.id} className="p-4 space-y-3" data-testid={`material-row-mobile-${mat.id}`}>
              <div className="flex items-start gap-3 min-w-0">
                {canManage ? (
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleSelect(mat.id)}
                    className="mt-1 h-5 w-5 rounded border-border accent-brand shrink-0"
                  />
                ) : null}
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${typeInfo.bg}`}>
                  <Icon className={`h-5 w-5 ${typeInfo.color}`} />
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="text-sm font-semibold text-foreground break-words line-clamp-2"
                    title={displayTitle}
                    data-testid={`material-title-${mat.id}`}
                  >
                    {displayTitle}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{typeInfo.label}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="inline-flex items-center px-3 py-2 min-h-touch text-sm rounded-lg border border-border hover:bg-brand-soft hover:text-brand"
                  onClick={() => handleOpen(mat)}
                >
                  Открыть
                </button>
                {externalLink ? null : (
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 min-h-touch text-sm rounded-lg border border-border"
                    onClick={() => handleDownload(mat)}
                  >
                    Скачать
                  </button>
                )}
                {mayEdit(mat) ? (
                  <button
                    type="button"
                    className="inline-flex items-center px-3 py-2 min-h-touch text-sm rounded-lg border border-border"
                    onClick={() => onEdit(mat)}
                  >
                    Изменить
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="border-b border-border">
              {canManage && (
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="rounded border-border accent-brand"
                  />
                </th>
              )}
              <th className="px-3 py-2.5 text-left font-medium min-w-[14rem] w-[42%]">Название</th>
              <th className="px-3 py-2.5 text-left font-medium hidden sm:table-cell">Тип</th>
              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">Курс</th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Папка</th>
              <th className="px-3 py-2.5 text-left font-medium hidden xl:table-cell">Дата</th>
              <th className="w-12 px-3 py-2.5 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {materials.map((mat) => {
              const typeInfo = getMaterialTypeInfo(mat);
              const Icon = typeInfo.icon;
              const meta = unpackMaterialDescription(mat.description);
              const selected = selectedIds.has(mat.id);
              const draggable = Boolean(canDragMaterials && mayEdit(mat));
              const displayTitle = resolveMaterialDisplayTitle(mat);
              const externalLink = isExternalLinkMaterial(mat) || isCanvaMaterial(mat);

              return (
                <tr
                  key={mat.id}
                  draggable={draggable}
                  onDragStart={(e) => {
                    if (!draggable) return;
                    const ids = resolveDragIds(mat);
                    if (ids.length === 0) {
                      e.preventDefault();
                      return;
                    }
                    setMaterialDragData(e.dataTransfer, ids);
                    e.dataTransfer.setDragImage?.(e.currentTarget, 24, 24);
                  }}
                  className={`group border-b border-border last:border-0 hover:bg-muted/30 ${
                    selected ? 'bg-brand-soft/60 dark:bg-brand-soft/20' : ''
                  } ${draggable ? 'cursor-grab active:cursor-grabbing' : ''}`}
                  title={draggable ? 'Перетащите в курс или папку слева' : undefined}
                  data-testid={`material-row-${mat.id}`}
                >
                  {canManage && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1.5">
                        {draggable && (
                          <span className="text-muted-foreground" aria-hidden>
                            <GripVertical className="h-3.5 w-3.5" />
                          </span>
                        )}
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={() => onToggleSelect(mat.id)}
                          className="rounded border-border accent-brand"
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    </td>
                  )}
                  <td className="px-3 py-2.5 min-w-0 max-w-0 w-[42%]">
                    <div className="flex items-start gap-2.5 min-w-0 w-full">
                      {!canManage && draggable && (
                        <span className="mt-1.5 text-muted-foreground shrink-0" aria-hidden>
                          <GripVertical className="h-3.5 w-3.5" />
                        </span>
                      )}
                      <div className={`h-9 w-9 rounded-lg ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                      </div>
                      <div className="min-w-0 flex-1 overflow-hidden">
                        <button
                          type="button"
                          className="block w-full max-w-full text-left text-sm font-semibold text-foreground hover:text-brand hover:underline break-words whitespace-normal line-clamp-2"
                          title={displayTitle}
                          data-testid={`material-title-${mat.id}`}
                          onClick={() => handleOpen(mat)}
                          onMouseDown={(e) => e.stopPropagation()}
                        >
                          {displayTitle}
                        </button>
                        {meta.blockName && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{meta.blockName}</p>
                        )}
                        <AccessSourceBadges sources={mat.access_sources} className="mt-1" />
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">{typeInfo.label}</td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell truncate max-w-[10rem]">
                    {courseName(mat.course_id)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden lg:table-cell truncate max-w-[8rem]">
                    {folderName(mat.folder_id)}
                  </td>
                  <td className="px-3 py-2.5 text-muted-foreground hidden xl:table-cell">
                    {formatDate(mat.created_date || mat.created_at)}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-8 w-8 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground"
                          aria-label="Действия"
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem onClick={() => handleOpen(mat)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Открыть
                        </DropdownMenuItem>
                        {externalLink ? null : (
                          <DropdownMenuItem onClick={() => handleDownload(mat)}>
                            <Download className="h-4 w-4 mr-2" />
                            Скачать
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem onClick={() => handleOpen(mat)}>
                          <ExternalLink className="h-4 w-4 mr-2" />
                          В новой вкладке
                        </DropdownMenuItem>
                        {(mayEdit(mat) || canAccess) && <DropdownMenuSeparator />}
                        {mayEdit(mat) && (
                          <DropdownMenuItem onClick={() => onEdit(mat)}>
                            <Pencil className="h-4 w-4 mr-2" />
                            Редактировать
                          </DropdownMenuItem>
                        )}
                        {canAccess && (
                          <DropdownMenuItem
                            onClick={() => onAccess(mat)}
                            data-testid={`material-access-btn-${mat.id}`}
                          >
                            <Lock className="h-4 w-4 mr-2" />
                            <span title="Управление доступом">Настроить доступ</span>
                          </DropdownMenuItem>
                        )}
                        {mayEdit(mat) && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-red-600 focus:text-red-600"
                              disabled={deletingId === mat.id}
                              onClick={() => onDelete(mat.id)}
                              title="Удалить"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Удалить
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    {canAccess && (
                      <button
                        type="button"
                        className="sr-only"
                        title="Управление доступом"
                        onClick={() => onAccess(mat)}
                      >
                        Управление доступом
                      </button>
                    )}
                    {mayEdit(mat) && (
                      <button
                        type="button"
                        className="sr-only"
                        title="Удалить"
                        disabled={deletingId === mat.id}
                        onClick={() => onDelete(mat.id)}
                      >
                        Удалить
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
