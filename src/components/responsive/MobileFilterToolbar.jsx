import { SlidersHorizontal } from 'lucide-react';
import { Button, SearchField } from '@/design-system';
import { cn } from '@/lib/utils';
import MobileFilterChips from '@/components/responsive/MobileFilterChips';

/**
 * Shared admin mobile toolbar: search → filters button → active chips.
 * Desktop pages may hide the filters button (`showFiltersButton=false`) and keep chips.
 */
export default function MobileFilterToolbar({
  searchValue,
  onSearchChange,
  searchPlaceholder = 'Поиск…',
  searchAriaLabel = 'Поиск',
  filtersOpenLabel = 'Фильтры',
  activeFilterCount = 0,
  onOpenFilters,
  showFiltersButton = true,
  chips = [],
  onRemoveChip,
  onClearAll,
  trailing = null,
  className,
}) {
  return (
    <div className={cn('space-y-3 min-w-0', className)}>
      <div className="flex gap-2 items-stretch min-w-0">
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={searchPlaceholder}
          aria-label={searchAriaLabel}
          className="flex-1 min-w-0"
          inputClassName="min-h-touch text-base"
        />
        {showFiltersButton ? (
          <Button
            type="button"
            intent="outline"
            className="shrink-0 min-h-touch px-3 sm:px-4"
            onClick={onOpenFilters}
            aria-label={filtersOpenLabel}
          >
            <SlidersHorizontal className="h-4 w-4 sm:mr-2" aria-hidden />
            <span className="hidden sm:inline">{filtersOpenLabel}</span>
            {activeFilterCount > 0 ? (
              <span className="ml-1.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[10px] font-bold text-white">
                {activeFilterCount > 9 ? '9+' : activeFilterCount}
              </span>
            ) : null}
          </Button>
        ) : null}
        {trailing}
      </div>
      <MobileFilterChips chips={chips} onRemove={onRemoveChip} onClearAll={onClearAll} />
    </div>
  );
}
