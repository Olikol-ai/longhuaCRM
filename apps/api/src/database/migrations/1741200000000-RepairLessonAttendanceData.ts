import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * RepairLessonAttendanceData
 *
 * Align attendance_records.student_id with lesson.primary_student_id
 * for individual lessons (all statuses). Group lessons are not modified.
 *
 * attendance_records is the LessonStudent link in this schema.
 */
export class RepairLessonAttendanceData1741200000000 implements MigrationInterface {
  name = 'RepairLessonAttendanceData1741200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE attendance_records AS a
      SET student_id = l.primary_student_id,
          updated_at = NOW()
      FROM lessons AS l
      WHERE a.lesson_id = l.id
        AND l.lesson_type = 'individual'
        AND l.group_id IS NULL
        AND l.primary_student_id IS NOT NULL
        AND a.student_id IS DISTINCT FROM l.primary_student_id
        AND NOT EXISTS (
          SELECT 1
          FROM attendance_records AS a2
          WHERE a2.lesson_id = a.lesson_id
            AND a2.student_id = l.primary_student_id
        )
    `);

    await queryRunner.query(`
      DELETE FROM attendance_records AS a
      USING lessons AS l
      WHERE a.lesson_id = l.id
        AND l.lesson_type = 'individual'
        AND l.group_id IS NULL
        AND l.primary_student_id IS NOT NULL
        AND a.student_id IS DISTINCT FROM l.primary_student_id
        AND EXISTS (
          SELECT 1
          FROM attendance_records AS a2
          WHERE a2.lesson_id = a.lesson_id
            AND a2.student_id = l.primary_student_id
        )
    `);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Data repair — irreversible.
  }
}
