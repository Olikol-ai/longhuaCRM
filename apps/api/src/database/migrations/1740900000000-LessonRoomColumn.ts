import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds optional classroom/room label on lessons for offline schedule details.
 */
export class LessonRoomColumn1740900000000 implements MigrationInterface {
  name = 'LessonRoomColumn1740900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
      ADD COLUMN IF NOT EXISTS "room" character varying(128) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "lessons"
      DROP COLUMN IF EXISTS "room"
    `);
  }
}
