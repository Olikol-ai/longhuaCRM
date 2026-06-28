const SYSTEM_RECORD_FIELDS = new Set(['id', 'created_date', 'updated_date']);

export function camelToSnake(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z])([A-Z][a-z])/g, '$1_$2')
    .toLowerCase();
}

export function snakeToCamel(value: string): string {
  return value.replace(/_([a-z0-9])/g, (_, char: string) => char.toUpperCase());
}

function serializeFieldValue(value: unknown): unknown {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    return value;
  }

  return value;
}

export function entityToRecord(row: Record<string, unknown>): Record<string, unknown> {
  const record: Record<string, unknown> = {
    id: row.id,
  };

  for (const [key, value] of Object.entries(row)) {
    if (key === 'id' || key === 'createdDate' || key === 'updatedDate') {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    record[camelToSnake(key)] = serializeFieldValue(value);
  }

  if (row.createdDate instanceof Date) {
    record.created_date = row.createdDate.toISOString();
  }

  if (row.updatedDate instanceof Date) {
    record.updated_date = row.updatedDate.toISOString();
  }

  return record;
}

export function recordToEntityPayload(
  input: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(input)) {
    if (SYSTEM_RECORD_FIELDS.has(key)) {
      continue;
    }

    if (value === undefined) {
      continue;
    }

    payload[snakeToCamel(key)] = value;
  }

  return payload;
}

export function matchesFilter(record: Record<string, unknown>, query: Record<string, unknown>): boolean {
  return Object.entries(query).every(([key, value]) => {
    if (value && typeof value === 'object' && value !== null && '$contains' in value) {
      const field = record[key];
      return field != null && String(field).includes(String((value as { $contains: unknown }).$contains));
    }
    if (Array.isArray(record[key])) {
      return (record[key] as unknown[]).includes(value);
    }
    return record[key] == value;
  });
}

export function sortRecords(records: Record<string, unknown>[], sortField?: string): Record<string, unknown>[] {
  if (!sortField) return records;
  const desc = sortField.startsWith('-');
  const field = desc ? sortField.slice(1) : sortField;
  return [...records].sort((a, b) => {
    const av = a[field] ?? '';
    const bv = b[field] ?? '';
    if (av < bv) return desc ? 1 : -1;
    if (av > bv) return desc ? -1 : 1;
    return 0;
  });
}
