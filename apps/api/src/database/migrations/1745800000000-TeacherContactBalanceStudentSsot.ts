import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Student SSOT cleanup for school teachers:
 * 1) Merge any leftover contact.lesson_balance into linked students.lesson_balance (GREATEST).
 * 2) Zero teacher contact balances — column remains for tutors only (deprecated for teachers).
 *
 * Do NOT DROP lesson_balance: tutors still use it as their private notebook balance.
 */
export class TeacherContactBalanceStudentSsot1745800000000
  implements MigrationInterface
{
  name = 'TeacherContactBalanceStudentSsot1745800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE students AS s
      SET lesson_balance = GREATEST(
        COALESCE(s.lesson_balance, 0),
        COALESCE(c.lesson_balance, 0)
      )
      FROM teacher_student_contacts AS c
      WHERE c.owner_type = 'teacher'
        AND c.linked_student_id IS NOT NULL
        AND c.linked_student_id = s.id
    `);

    await queryRunner.query(`
      UPDATE teacher_student_contacts
      SET lesson_balance = 0
      WHERE owner_type = 'teacher'
    `);

    await queryRunner.query(`
      COMMENT ON COLUMN teacher_student_contacts.lesson_balance IS
        'Tutor private notebook balance. Deprecated for owner_type=teacher — SSOT is students.lesson_balance via linked_student_id.'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      COMMENT ON COLUMN teacher_student_contacts.lesson_balance IS NULL
    `);
    // Cannot restore previous teacher contact balances after zeroing.
  }
}
