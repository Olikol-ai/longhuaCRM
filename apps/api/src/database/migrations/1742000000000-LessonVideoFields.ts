import { MigrationInterface, QueryRunner } from 'typeorm';

export class LessonVideoFields1742000000000 implements MigrationInterface {
  name = 'LessonVideoFields1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE lessons
        ADD COLUMN IF NOT EXISTS video_provider varchar(64) NULL,
        ADD COLUMN IF NOT EXISTS video_room_id varchar(128) NULL,
        ADD COLUMN IF NOT EXISTS video_room_url text NULL,
        ADD COLUMN IF NOT EXISTS reminder_15m_sent boolean NOT NULL DEFAULT false
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_LESSONS_VIDEO_ROOM_ID ON lessons (video_room_id)
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS IDX_LESSONS_VIDEO_ROOM_ID`);
    await queryRunner.query(`
      ALTER TABLE lessons
        DROP COLUMN IF EXISTS reminder_15m_sent,
        DROP COLUMN IF EXISTS video_room_url,
        DROP COLUMN IF EXISTS video_room_id,
        DROP COLUMN IF EXISTS video_provider
    `);
  }
}
