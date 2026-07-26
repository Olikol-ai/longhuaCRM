import { MigrationInterface, QueryRunner } from 'typeorm';

type StudentNameConflictRow = {
  id: string;
  user_id: string | null;
  name: string;
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

/**
 * RepairStudentUserNameSync
 *
 * Student.name is SSOT for display. Re-derive students.first_name/last_name
 * from name when they diverge, then align linked users.first_name/last_name.
 * Logs every conflict found.
 */
export class RepairStudentUserNameSync1741300000000 implements MigrationInterface {
  name = 'RepairStudentUserNameSync1741300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows = (await queryRunner.query(`
      SELECT
        s.id,
        s.user_id,
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
      `[RepairStudentUserNameSync] found ${rows.length} student/user name conflict(s)`,
    );

    for (const row of rows) {
      const displayName = String(row.name ?? '').trim();
      const composed = String(row.composed ?? '').trim();
      const nameMismatch = Boolean(displayName && composed && displayName !== composed);
      const parsed = nameMismatch
        ? splitDisplayName(displayName)
        : {
            firstName: String(row.first_name ?? '').trim(),
            lastName: String(row.last_name ?? '').trim(),
          };

      // eslint-disable-next-line no-console
      console.warn(
        `[RepairStudentUserNameSync] conflict student=${row.id}` +
          ` name="${displayName}"` +
          ` composed="${composed}"` +
          ` parts="${row.last_name ?? ''} ${row.first_name ?? ''}"` +
          ` user="${row.user_last_name ?? ''} ${row.user_first_name ?? ''}"` +
          ` → fix last="${parsed.lastName}" first="${parsed.firstName}"`,
      );

      if (nameMismatch) {
        await queryRunner.query(
          `
            UPDATE students
            SET first_name = $2,
                last_name = $3,
                updated_at = NOW()
            WHERE id = $1
          `,
          [row.id, parsed.firstName || null, parsed.lastName || null],
        );
      }

      if (row.user_id) {
        await queryRunner.query(
          `
            UPDATE users
            SET first_name = $2,
                last_name = $3,
                updated_date = NOW()
            WHERE id = $1
          `,
          [row.user_id, parsed.firstName || null, parsed.lastName || null],
        );
      }
    }
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data repair — irreversible.
  }
}
