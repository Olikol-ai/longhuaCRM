import {
  StudentBalanceOperationType,
  StudentBalanceSourceType,
} from './entities/student-balance-ledger.entity';

/**
 * Admin Balance card history item — one ledger movement of lesson_balance.
 * Money amounts are intentionally not synthesized here; `delta` is lessons.
 */
export type AdminBalanceHistoryItem = {
  id: string;
  /** ISO timestamptz of the balance movement (ledger.created_at) */
  movement_at: string;
  /** YYYY-MM-DD derived from movement_at (compat / filters) */
  date: string;
  /** Ledger operation_type */
  type: StudentBalanceOperationType | string;
  label: string;
  /** Lesson-count delta (positive = credit / restore) */
  delta: number;
  /** Always null — history is lesson movements, not money ledgers */
  amount: number | null;
  comment: string | null;
  lesson_id: string | null;
  payment_id: string | null;
  /** Existing ledger reason surface (operation_type) */
  status: string | null;
  operation_type: string;
  source_type: string;
};

export type LedgerHistorySource = {
  id: string;
  delta: number;
  operationType: string;
  sourceType: string;
  sourceId?: string | null;
  description?: string | null;
  createdAt: Date | string;
};

const OPERATION_LABELS: Record<string, string> = {
  credit: 'Пополнение',
  debit: 'Списание',
  restore: 'Возврат',
  adjustment: 'Корректировка',
  initial: 'Начальный остаток',
  merge_in: 'Объединение (+)',
  merge_out: 'Объединение (−)',
  legacy_reconciliation: 'Сверка (legacy)',
};

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function balanceHistoryLabel(operationType: string): string {
  return OPERATION_LABELS[operationType] || operationType || 'Движение';
}

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

function asIso(value: Date | string): string {
  const d = toDate(value);
  if (Number.isNaN(d.getTime())) {
    return new Date(0).toISOString();
  }
  return d.toISOString();
}

function dateOnly(iso: string): string {
  return iso.slice(0, 10);
}

function resolveLessonId(
  sourceType: string,
  sourceId: string | null | undefined,
): string | null {
  if (!sourceId || !UUID_RE.test(sourceId)) return null;
  if (sourceType === 'lesson' || sourceType === 'attendance') {
    return sourceId;
  }
  return null;
}

function resolvePaymentId(
  sourceType: string,
  sourceId: string | null | undefined,
): string | null {
  if (!sourceId || !UUID_RE.test(sourceId)) return null;
  if (sourceType === 'payment') return sourceId;
  return null;
}

/**
 * Map one ledger row into the admin history DTO.
 * Does not invent movements — only normalizes existing ledger fields.
 */
export function mapLedgerEntryToHistoryItem(
  entry: LedgerHistorySource,
): AdminBalanceHistoryItem {
  const movementAt = asIso(entry.createdAt);
  const operationType = String(entry.operationType || '');
  const sourceType = String(entry.sourceType || '');
  const sourceId = entry.sourceId ?? null;
  const description = entry.description?.trim() || null;

  return {
    id: entry.id,
    movement_at: movementAt,
    date: dateOnly(movementAt),
    type: operationType,
    label: balanceHistoryLabel(operationType),
    delta: Math.trunc(Number(entry.delta) || 0),
    amount: null,
    comment: description,
    lesson_id: resolveLessonId(sourceType, sourceId),
    payment_id: resolvePaymentId(sourceType, sourceId),
    status: operationType || null,
    operation_type: operationType,
    source_type: sourceType,
  };
}

/**
 * Chronological ASC by movement timestamp, then stable id.
 * Never sorts by formatted date strings or by operation type groups.
 */
export function sortBalanceHistoryAsc(
  items: AdminBalanceHistoryItem[],
): AdminBalanceHistoryItem[] {
  return [...items].sort((a, b) => {
    const ta = Date.parse(a.movement_at) || 0;
    const tb = Date.parse(b.movement_at) || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
}

/**
 * Build the full personal balance-movement timeline from ledger rows.
 */
export function buildBalanceHistoryFromLedger(
  entries: LedgerHistorySource[],
): AdminBalanceHistoryItem[] {
  const mapped = entries.map(mapLedgerEntryToHistoryItem);
  return sortBalanceHistoryAsc(mapped);
}

/** Type re-exports for callers that already import operation types */
export type {
  StudentBalanceOperationType,
  StudentBalanceSourceType,
};
