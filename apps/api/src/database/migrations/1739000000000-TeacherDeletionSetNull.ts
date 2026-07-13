import { MigrationInterface, QueryRunner } from 'typeorm';
import { rebindTeacherFkToSetNull } from '../migration-helpers';

/**
 * Teacher profile deletion must preserve CRM history.
 * Business entities keep rows with teacher_id = NULL instead of blocking DELETE.
 *
 * CASCADE is kept on teacher_availability_* — slots/bookings are teacher-only
 * schedule data removed with the profile (also deleted explicitly in service).
 */
export class TeacherDeletionSetNull1739000000000 implements MigrationInterface {
  name = 'TeacherDeletionSetNull1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await rebindTeacherFkToSetNull(
      queryRunner,
      'lessons',
      'teacher_id',
      'FK_lessons_teacher_id_set_null',
    );
    await rebindTeacherFkToSetNull(
      queryRunner,
      'lesson_series',
      'teacher_id',
      'FK_lesson_series_teacher_id_set_null',
    );
    await rebindTeacherFkToSetNull(
      queryRunner,
      'groups',
      'teacher_id',
      'FK_groups_teacher_id_set_null',
    );
    await rebindTeacherFkToSetNull(
      queryRunner,
      'teacher_payments',
      'teacher_id',
      'FK_teacher_payments_teacher_id_set_null',
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      { table: 'teacher_payments', column: 'teacher_id', name: 'FK_teacher_payments_teacher_id_set_null' },
      { table: 'groups', column: 'teacher_id', name: 'FK_groups_teacher_id_set_null' },
      { table: 'lesson_series', column: 'teacher_id', name: 'FK_lesson_series_teacher_id_set_null' },
      { table: 'lessons', column: 'teacher_id', name: 'FK_lessons_teacher_id_set_null' },
    ];

    for (const fk of tables) {
      await queryRunner.query(
        `ALTER TABLE "${fk.table}" DROP CONSTRAINT IF EXISTS "${fk.name}"`,
      );
    }
  }
}
