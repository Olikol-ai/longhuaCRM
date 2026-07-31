import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Adds speaking/audio answer fields and homework per-answer review metadata
 * for manual ShortText / Translation / Speaking questions.
 */
export class ManualQuestionAudioAndReview1744400000000 implements MigrationInterface {
  name = 'ManualQuestionAudioAndReview1744400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_attempt_answers
        ADD COLUMN IF NOT EXISTS audio_storage_key text NULL,
        ADD COLUMN IF NOT EXISTS audio_mime varchar(128) NULL,
        ADD COLUMN IF NOT EXISTS audio_original_filename text NULL,
        ADD COLUMN IF NOT EXISTS audio_duration_ms int NULL
    `);

    await queryRunner.query(`
      ALTER TABLE homework_attempt_answers
        ADD COLUMN IF NOT EXISTS audio_storage_key text NULL,
        ADD COLUMN IF NOT EXISTS audio_mime varchar(128) NULL,
        ADD COLUMN IF NOT EXISTS audio_original_filename text NULL,
        ADD COLUMN IF NOT EXISTS audio_duration_ms int NULL,
        ADD COLUMN IF NOT EXISTS review_comment text NULL,
        ADD COLUMN IF NOT EXISTS reviewed_by_user_id uuid NULL,
        ADD COLUMN IF NOT EXISTS reviewed_at timestamptz NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_attempt_answers
        DROP COLUMN IF EXISTS audio_storage_key,
        DROP COLUMN IF EXISTS audio_mime,
        DROP COLUMN IF EXISTS audio_original_filename,
        DROP COLUMN IF EXISTS audio_duration_ms
    `);
    await queryRunner.query(`
      ALTER TABLE homework_attempt_answers
        DROP COLUMN IF EXISTS audio_storage_key,
        DROP COLUMN IF EXISTS audio_mime,
        DROP COLUMN IF EXISTS audio_original_filename,
        DROP COLUMN IF EXISTS audio_duration_ms,
        DROP COLUMN IF EXISTS review_comment,
        DROP COLUMN IF EXISTS reviewed_by_user_id,
        DROP COLUMN IF EXISTS reviewed_at
    `);
  }
}
