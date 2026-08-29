import { cn } from '@/lib/utils';

/**
 * Desktop (lg+): HTML table.
 * Mobile/tablet: stacked cards from the same row data (no duplicated fetch).
 *
 * @param {object} props
 * @param {Array} props.rows
 * @param {Array<{ id: string, header: string, cell: (row: any, index: number) => React.ReactNode, cardLabel?: string, hideOnCard?: boolean, className?: string }>} props.columns
 * @param {(row: any, index: number) => string} [props.getRowKey]
 * @param {(row: any, index: number) => React.ReactNode} [props.cardTitle]
 * @param {(row: any, index: number) => React.ReactNode} [props.cardActions]
 * @param {(row: any, index: number) => void} [props.onRowClick]
 * @param {string} [props.empty]
 * @param {string} [props.className]
 */
export default function ResponsiveTable({
  rows = [],
  columns = [],
  getRowKey = (row, index) => row?.id ?? index,
  cardTitle = null,
  cardActions = null,
  onRowClick = null,
  empty = 'Нет данных',
  className = '',
  tableClassName = '',
}) {
  if (!rows.length) {
    return (
      <div className={cn('rounded-2xl border border-border bg-card p-8 text-center text-sm text-muted-foreground', className)}>
        {empty}
      </div>
    );
  }

  const cardColumns = columns.filter((col) => !col.hideOnCard);
  const clickable = typeof onRowClick === 'function';

  return (
    <div className={cn('min-w-0', className)}>
      {/* Mobile / tablet cards */}
      <div className="lg:hidden space-y-3">
        {rows.map((row, index) => (
          <article
            key={getRowKey(row, index)}
            className={cn(
              'rounded-2xl border border-border bg-card p-4 space-y-3 shadow-sm min-w-0',
              clickable && 'cursor-pointer hover:border-brand/40',
            )}
            role={clickable ? 'button' : undefined}
            tabIndex={clickable ? 0 : undefined}
            onClick={clickable ? () => onRowClick(row, index) : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onRowClick(row, index);
                    }
                  }
                : undefined
            }
          >
            {cardTitle ? (
              <div className="font-semibold text-foreground min-w-0 break-words">
                {cardTitle(row, index)}
              </div>
            ) : null}
            <dl className="grid gap-2 text-sm">
              {cardColumns.map((col) => (
                <div
                  key={col.id}
                  className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)] gap-2 items-start"
                >
                  <dt className="text-muted-foreground text-xs uppercase tracking-wide pt-0.5">
                    {col.cardLabel || col.header}
                  </dt>
                  <dd className="min-w-0 break-words text-foreground">{col.cell(row, index)}</dd>
                </div>
              ))}
            </dl>
            {cardActions ? (
              <div
                className="flex flex-wrap gap-2 pt-1 border-t border-border [&_button]:min-h-touch"
                onClick={(e) => e.stopPropagation()}
              >
                {cardActions(row, index)}
              </div>
            ) : null}
          </article>
        ))}
      </div>

      {/* Desktop table */}
      <div className="hidden lg:block rounded-2xl border border-border bg-card overflow-x-auto">
        <table className={cn('w-full text-sm', tableClassName)}>
          <thead>
            <tr className="border-b border-border text-left text-muted-foreground">
              {columns.map((col) => (
                <th key={col.id} className={cn('px-4 py-3 font-medium whitespace-nowrap', col.className)}>
                  {col.header}
                </th>
              ))}
              {cardActions ? <th className="px-4 py-3 font-medium">Действия</th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={getRowKey(row, index)}
                className={cn(
                  'border-b border-border last:border-0',
                  clickable && 'cursor-pointer hover:bg-muted/40',
                )}
                onClick={clickable ? () => onRowClick(row, index) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.id} className={cn('px-4 py-3 align-middle', col.className)}>
                    {col.cell(row, index)}
                  </td>
                ))}
                {cardActions ? (
                  <td
                    className="px-4 py-3 align-middle"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="flex flex-wrap gap-2">{cardActions(row, index)}</div>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
