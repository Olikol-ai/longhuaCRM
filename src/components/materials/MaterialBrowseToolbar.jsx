import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  MATERIAL_SORT_OPTIONS,
  MATERIAL_TYPE_FILTERS,
} from '@/lib/materialBrowse';

const selectClass =
  'w-full min-w-0 min-h-touch rounded-lg border border-input bg-background px-3 py-2 text-sm';

/**
 * Compact search + type/block/sort controls for materials lists.
 */
export default function MaterialBrowseToolbar({
  search,
  onSearchChange,
  typeFilter,
  onTypeFilterChange,
  blockFilter = 'all',
  onBlockFilterChange,
  blocks = [],
  sort,
  onSortChange,
  showBlockFilter = true,
  showReset = false,
  onReset,
  extraFilters = null,
}) {
  return (
    <div className="space-y-3" data-testid="materials-browse-toolbar">
      <div className="relative w-full">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={search}
          onChange={(e) => onSearchChange?.(e.target.value)}
          placeholder="Поиск материалов…"
          className="pl-9 min-h-touch"
          aria-label="Поиск материалов"
        />
      </div>

      <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2 min-w-0">
        {extraFilters}
        <select
          value={typeFilter}
          onChange={(e) => onTypeFilterChange?.(e.target.value)}
          className={`${selectClass} sm:w-auto sm:min-w-[10rem]`}
          aria-label="Тип файла"
        >
          {MATERIAL_TYPE_FILTERS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {showBlockFilter ? (
          <select
            value={blockFilter}
            onChange={(e) => onBlockFilterChange?.(e.target.value)}
            className={`${selectClass} sm:w-auto sm:min-w-[10rem]`}
            aria-label="Раздел"
            disabled={blocks.length === 0 && blockFilter === 'all'}
          >
            <option value="all">Все разделы</option>
            {blocks.map((block) => (
              <option key={block} value={block}>
                {block}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={sort}
          onChange={(e) => onSortChange?.(e.target.value)}
          className={`${selectClass} sm:w-auto sm:min-w-[14rem]`}
          aria-label="Сортировка"
        >
          {MATERIAL_SORT_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        {showReset ? (
          <Button
            type="button"
            variant="outline"
            onClick={onReset}
            className="min-h-touch sm:w-auto"
          >
            Сбросить фильтры
          </Button>
        ) : null}
      </div>
    </div>
  );
}
