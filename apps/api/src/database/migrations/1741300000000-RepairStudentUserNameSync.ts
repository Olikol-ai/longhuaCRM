import { MigrationInterface, QueryRunner } from 'typeorm';

type StudentNameConflictRow = {
  id: string;
  user_id: string | null;
  email: string | null;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  composed: string | null;
  user_first_name: string | null;
  user_last_name: string | null;
};

function splitDisplayName(name: string): { firstName: string; lastName: string } {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    lastName: parts[0],
    firstName: parts.slice(1).join(' '),
  };
}

/** Empty / whitespace-only Student.name must never drive User sync. */
function isBlankStudentName(name: string | null | undefined): boolean {
  return String(name ?? '').trim() === '';
}

/**
 * Resolve repair parts from Student.name (SSOT).
 * Returns null when name is blank or yields no usable parts.
 */
function resolveRepairNameParts(
  name: string | null | undefined,
): { firstName: string; lastName: string } | null {
  if (isBlankStudentName(name)) {
    return null;
  }
  const parsed = splitDisplayName(String(name).trim());
  if (!parsed.firstName && !parsed.lastName) {
    return null;
  }
  return parsed;
}

/**
 * users.first_name is NOT NULL — never sync when resolved firstName is empty.
 */
function canSyncLinkedUser(parts: {
  firstName: string;
  lastName: string;
}): boolean {
  return String(parts.firstName ?? '').trim().length > 0;
}

/**
 * RepairStudentUserNameSync
 *
 * Student.name is SSOT for display. Re-derive students.first_name/last_name
 * from name when they diverge, then align linked users.first_name/last_name.
 *
 * Idempotent: re-running skips rows that already match.
 * Safe on legacy data: blank Student.name is logged and skipped (never writes
 * NULL/empty into users.first_name).
 *
 * IMPORTANT: only this class may be exported from this file. TypeORM
 * buildMigrations() instantiates every export with `new`.
 */
export class RepairStudentUserNameSync1741300000000 implements MigrationInterface {
  name = 'RepairStudentUserNameSync1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const emptyNameRows = (await queryRunner.query(`
      SELECT s.id, s.email, s.user_id
      FROM students s
      WHERE TRIM(COALESCE(s.name, '')) = ''
    `)) as Array<{ id: string; email: string | null; user_id: string | null }>;

    for (const row of emptyNameRows) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RepairStudentUserNameSync] skip empty name` +
          ` student=${row.id}` +
          ` email=${row.email ?? ''}` +
          ` user_id=${row.user_id ?? ''}`,
      );
    }

    const rows = (await queryRunner.query(`
      SELECT
        s.id,
        s.user_id,
        s.email,
        TRIM(s.name) AS name,
        s.first_name,
        s.last_name,
        NULLIF(
          TRIM(BOTH FROM CONCAT_WS(
            ' ',
            NULLIF(TRIM(COALESCE(s.last_name, '')), ''),
            NULLIF(TRIM(COALESCE(s.first_name, '')), '')
          )),
          ''
        ) AS composed,
        u.first_name AS user_first_name,
        u.last_name AS user_last_name
      FROM students s
      LEFT JOIN users u ON u.id = s.user_id
      WHERE TRIM(COALESCE(s.name, '')) <> ''
        AND (
          NULLIF(
            TRIM(BOTH FROM CONCAT_WS(
              ' ',
              NULLIF(TRIM(COALESCE(s.last_name, '')), ''),
              NULLIF(TRIM(COALESCE(s.first_name, '')), '')
            )),
            ''
          ) IS DISTINCT FROM TRIM(s.name)
          OR (
            s.user_id IS NOT NULL
            AND (
              TRIM(COALESCE(u.last_name, ''))
                IS DISTINCT FROM TRIM(COALESCE(s.last_name, ''))
              OR TRIM(COALESCE(u.first_name, ''))
                IS DISTINCT FROM TRIM(COALESCE(s.first_name, ''))
            )
          )
        )
    `)) as StudentNameConflictRow[];

    // eslint-disable-next-line no-console
    console.warn(
      `[RepairStudentUserNameSync] found ${rows.length} student/user name conflict(s)` +
        `; empty-name skipped=${emptyNameRows.length}`,
    );

    for (const row of rows) {
      try {
        await this.repairRow(queryRunner, row);
      } catch (error) {
        // eslint-disable-next-line no-console
        console.warn(
          `[RepairStudentUserNameSync] continue after error` +
            ` student=${row.id}` +
            ` email=${row.email ?? ''}` +
            ` error=${(error as Error).message}`,
        );
      }
    }
  }

  private async repairRow(
    queryRunner: QueryRunner,
    row: StudentNameConflictRow,
  ): Promise<void> {
    if (isBlankStudentName(row.name)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RepairStudentUserNameSync] skip empty name` +
          ` student=${row.id}` +
          ` email=${row.email ?? ''}`,
      );
      return;
    }

    const parsed = resolveRepairNameParts(row.name);
    if (!parsed) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RepairStudentUserNameSync] skip unparseable name` +
          ` student=${row.id}` +
          ` email=${row.email ?? ''}` +
          ` name="${row.name ?? ''}"`,
      );
      return;
    }

    const displayName = String(row.name).trim();
    const composed = String(row.composed ?? '').trim();
    const studentPartsMismatch =
      composed !== displayName
      || String(row.first_name ?? '').trim() !== parsed.firstName
      || String(row.last_name ?? '').trim() !== parsed.lastName;

    // eslint-disable-next-line no-console
    console.warn(
      `[RepairStudentUserNameSync] conflict student=${row.id}` +
        ` email=${row.email ?? ''}` +
        ` name="${displayName}"` +
        ` composed="${composed}"` +
        ` parts="${row.last_name ?? ''} ${row.first_name ?? ''}"` +
        ` user="${row.user_last_name ?? ''} ${row.user_first_name ?? ''}"` +
        ` → fix last="${parsed.lastName}" first="${parsed.firstName}"`,
    );

    if (studentPartsMismatch) {
      await queryRunner.query(
        `
          UPDATE students
          SET first_name = $2,
              last_name = NULLIF($3, ''),
              updated_at = NOW()
          WHERE id = $1
            AND (
              TRIM(COALESCE(first_name, '')) IS DISTINCT FROM $2
              OR TRIM(COALESCE(last_name, '')) IS DISTINCT FROM $3
            )
        `,
        [row.id, parsed.firstName || null, parsed.lastName],
      );
    }

    if (!row.user_id) {
      return;
    }

    if (!canSyncLinkedUser(parsed)) {
      // eslint-disable-next-line no-console
      console.warn(
        `[RepairStudentUserNameSync] skip user sync (empty first_name)` +
          ` student=${row.id}` +
          ` email=${row.email ?? ''}` +
          ` user_id=${row.user_id}` +
          ` name="${displayName}"`,
      );
      return;
    }

    await queryRunner.query(
      `
        UPDATE users
        SET first_name = $2,
            last_name = $3,
            updated_date = NOW()
        WHERE id = $1
          AND (
            TRIM(COALESCE(first_name, '')) IS DISTINCT FROM $2
            OR TRIM(COALESCE(last_name, '')) IS DISTINCT FROM $3
          )
      `,
      [row.user_id, parsed.firstName, parsed.lastName],
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data repair — irreversible.
  }
}
