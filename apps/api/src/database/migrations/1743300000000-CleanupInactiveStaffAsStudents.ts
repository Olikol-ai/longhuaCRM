import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Detach inactive CRM student shells from teachers when the same person is now
 * a non-student system user (tutor / teacher / admin).
 *
 * Root cause of “tutor appears as manual student”:
 * role change student→tutor unlinks users from students (user_id=NULL, status=inactive)
 * but keeps assigned_teacher_id for referral history. Teacher notebooks then listed
 * those shells as “Добавленные вручную”. Live lists now exclude inactive rows;
 * this cleanup clears assignment for staff identities so leftover shells cannot
 * resurface if filters regress.
 *
 * Does NOT delete student rows or lesson history. Does NOT touch contacts by name
 * (manual contacts are a separate table and may legitimately share names).
 */
export class CleanupInactiveStaffAsStudents1743300000000
  implements MigrationInterface
{
  name = 'CleanupInactiveStaffAsStudents1743300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE students s
      SET assigned_teacher_id = NULL
      WHERE s.status = 'inactive'
        AND s.user_id IS NULL
        AND s.assigned_teacher_id IS NOT NULL
        AND EXISTS (
          SELECT 1
          FROM users u
          WHERE lower(COALESCE(u.role, '')) IN ('tutor', 'teacher', 'admin')
            AND (
              (
                s.email IS NOT NULL
                AND btrim(s.email) <> ''
                AND lower(s.email) = lower(u.email)
              )
              OR (
                (s.email IS NULL OR btrim(s.email) = '')
                AND s.name IS NOT NULL
                AND btrim(s.name) <> ''
                AND lower(btrim(s.name)) IN (
                  lower(btrim(concat_ws(' ', NULLIF(u.last_name, ''), NULLIF(u.first_name, '')))),
                  lower(btrim(concat_ws(' ', NULLIF(u.first_name, ''), NULLIF(u.last_name, ''))))
                )
              )
            )
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Irreversible data cleanup — no-op.
  }
}
