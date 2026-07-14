import React from 'react';
import {
  Download,
  ExternalLink,
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
import { getMaterialUrl } from '@/lib/materialUrl';
import { unpackMaterialDescription } from '@/lib/materialMeta';
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
  canAccess,
  onOpen,
  onEdit,
  onAccess,
  onDelete,
  deletingId,
}) {
  const allSelected = materials.length > 0 && materials.every((m) => selectedIds.has(m.id));

  const courseName = (courseId) => {
    const course = courses.find((c) => c.id === courseId);
    return course?.course_name || course?.course_type || '—';
  };

  const folderName = (folderId) => {
    const folder = folders.find((f) => f.id === folderId);
    return folder?.name || 'Без папки';
  };

  if (materials.length === 0) {
    return (
      <div
        className="flex flex-col items-center justify-center py-16 px-6 border border-dashed border-border rounded-xl bg-card"
        data-testid="admin-materials-empty"
      >
        <p className="text-sm font-medium text-muted-foreground">Материалы не найдены</p>
        <p className="text-xs text-muted-foreground mt-1">Измените фильтры или добавьте материал</p>
      </div>
    );
  }

  return (
    <div className="border border-border rounded-xl bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-muted-foreground">
            <tr className="border-b border-border">
              {canManage && (
                <th className="w-10 px-3 py-2.5 text-left">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={(e) => onSelectAll(e.target.checked)}
                    className="rounded border-border accent-indigo-600"
                  />
                </th>
              )}
              <th className="px-3 py-2.5 text-left font-medium">Название</th>
              <th className="px-3 py-2.5 text-left font-medium hidden sm:table-cell">Тип</th>
              <th className="px-3 py-2.5 text-left font-medium hidden md:table-cell">Курс</th>
              <th className="px-3 py-2.5 text-left font-medium hidden lg:table-cell">Папка</th>
              <th className="px-3 py-2.5 text-left font-medium hidden xl:table-cell">Дата</th>
              <th className="w-12 px-3 py-2.5 text-right font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {materials.map((mat) => {
              const typeInfo = getMaterialTypeInfo(mat.file_type);
              const Icon = typeInfo.icon;
              const meta = unpackMaterialDescription(mat.description);
              const selected = selectedIds.has(mat.id);
              const url = getMaterialUrl(mat);

              return (
                <tr
                  key={mat.id}
                  className={`group border-b border-border last:border-0 hover:bg-muted/30 ${
                    selected ? 'bg-indigo-50/60 dark:bg-indigo-950/20' : ''
                  }`}
                >
                  {canManage && (
                    <td className="px-3 py-2.5">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => onToggleSelect(mat.id)}
                        className="rounded border-border accent-indigo-600"
                      />
                    </td>
                  )}
                  <td className="px-3 py-2.5">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <div className={`h-9 w-9 rounded-lg ${typeInfo.bg} flex items-center justify-center shrink-0`}>
                        <Icon className={`h-4 w-4 ${typeInfo.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-foreground truncate">{mat.title}</p>
                        {meta.blockName && (
                          <p className="text-xs text-muted-foreground mt-0.5">{meta.blockName}</p>
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
                        <DropdownMenuItem onClick={() => onOpen(mat)}>
                          <Eye className="h-4 w-4 mr-2" />
                          Открыть
                        </DropdownMenuItem>
                        {url && url !== '#' && (
                          <DropdownMenuItem asChild>
                            <a href={url} download target="_blank" rel="noopener noreferrer">
                              <Download className="h-4 w-4 mr-2" />
                              Скачать
                            </a>
                          </DropdownMenuItem>
                        )}
                        {url && url !== '#' && (
                          <DropdownMenuItem asChild>
                            <a href={url} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-4 w-4 mr-2" />
                              В новой вкладке
                            </a>
                          </DropdownMenuItem>
                        )}
                        {(canManage || canAccess) && <DropdownMenuSeparator />}
                        {canManage && (
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
                        {canManage && (
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
                    {/* Playwright: stable title selectors outside menu */}
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
                    {canManage && (
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
