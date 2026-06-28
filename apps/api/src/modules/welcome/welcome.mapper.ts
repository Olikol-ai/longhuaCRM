import { WelcomePageSettingEntity } from '../../entities/WelcomePageSetting.entity';

export const WELCOME_PAGE_FIELDS = [
  'school_name',
  'title',
  'subtitle',
  'body_text',
  'info_text',
] as const;

export type WelcomePageField = (typeof WELCOME_PAGE_FIELDS)[number];

export function welcomeRowsToRecord(
  rows: WelcomePageSettingEntity[],
): Record<string, unknown> | null {
  const values: Partial<Record<WelcomePageField, string>> = {};
  for (const row of rows) {
    if ((WELCOME_PAGE_FIELDS as readonly string[]).includes(row.key)) {
      values[row.key as WelcomePageField] = row.value ?? '';
    }
  }

  if (Object.keys(values).length === 0) {
    return null;
  }

  return {
    id: rows[0]?.id ?? 'welcome-page',
    ...values,
    created_date: rows[0]?.createdDate?.toISOString(),
    updated_date: rows[rows.length - 1]?.updatedDate?.toISOString(),
  };
}

export function welcomeInputToRows(
  input: Record<string, unknown>,
): Partial<WelcomePageSettingEntity>[] {
  const rows: Partial<WelcomePageSettingEntity>[] = [];

  for (const field of WELCOME_PAGE_FIELDS) {
    if (input[field] !== undefined) {
      rows.push({
        key: field,
        value: String(input[field] ?? ''),
        description: `Welcome page ${field}`,
        type: 'string',
        isActive: true,
      });
    }
  }

  return rows;
}
