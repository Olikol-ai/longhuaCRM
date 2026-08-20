import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Store stable file metadata on materials (mime, size, duration, original/safe names).
 * file_type remains varchar — add 'audio' via application enum only.
 */
export class MaterialFileMetadata1746100000000 implements MigrationInterface {
  name = 'MaterialFileMetadata1746100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "mime_type" varchar(128) NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "file_size_bytes" bigint NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "duration_seconds" integer NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "original_filename" text NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "materials"
      ADD COLUMN IF NOT EXISTS "stored_filename" text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN IF EXISTS "stored_filename"`);
    await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN IF EXISTS "original_filename"`);
    await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN IF EXISTS "duration_seconds"`);
    await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN IF EXISTS "file_size_bytes"`);
    await queryRunner.query(`ALTER TABLE "materials" DROP COLUMN IF EXISTS "mime_type"`);
  }
}
