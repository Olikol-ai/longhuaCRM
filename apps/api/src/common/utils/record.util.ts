export function nowIso(): string {
  return new Date().toISOString();
}

export function recordFromEntity(
  id: string,
  data: Record<string, unknown>,
  createdDate: Date,
  updatedDate: Date,
): Record<string, unknown> {
  const { id: _id, created_date: _c, updated_date: _u, ...rest } = data;
  return {
    ...rest,
    id,
    created_date: createdDate.toISOString(),
    updated_date: updatedDate.toISOString(),
  };
}

export function splitRecordPayload(
  input: Record<string, unknown>,
): { id?: string; payload: Record<string, unknown> } {
  const { id, created_date: _c, updated_date: _u, ...payload } = input;
  return { id: id as string | undefined, payload };
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
    return record[key] === value;
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
