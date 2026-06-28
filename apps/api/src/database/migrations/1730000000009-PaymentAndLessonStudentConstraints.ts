import { MigrationInterface, QueryRunner } from 'typeorm';

export class PaymentAndLessonStudentConstraints1730000000009 implements MigrationInterface {
  name = 'PaymentAndLessonStudentConstraints1730000000009';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_PAYMENT_PENDING_STUDENT_PACKAGE"
      ON "payments" ("student_id", "package_type")
      WHERE "status" = 'pending' AND "provider" = 'alfa_bank'
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "IDX_LESSON_STUDENT_LESSON_STUDENT"
      ON "lesson_students" ("lesson_id", "student_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_LESSON_STUDENT_LESSON_STUDENT"
    `);
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_PAYMENT_PENDING_STUDENT_PACKAGE"
    `);
  }
}
