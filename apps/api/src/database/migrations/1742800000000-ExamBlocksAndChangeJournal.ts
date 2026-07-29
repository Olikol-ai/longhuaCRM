import { MigrationInterface, QueryRunner } from 'typeorm';

export class ExamBlocksAndChangeJournal1742800000000 implements MigrationInterface {
  name = 'ExamBlocksAndChangeJournal1742800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_exam_blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        name text NOT NULL,
        description text NULL,
        level_label varchar(64) NULL,
        duration_minutes int NULL,
        status varchar(32) NOT NULL DEFAULT 'draft',
        created_by_user_id uuid NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_EXAM_BLOCKS_STATUS ON assessment_exam_blocks (status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_EXAM_BLOCKS_CREATED_BY ON assessment_exam_blocks (created_by_user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_exam_block_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        block_id uuid NOT NULL REFERENCES assessment_exam_blocks(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE RESTRICT,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (block_id, question_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_EXAM_BLOCK_ITEMS_BLOCK ON assessment_exam_block_items (block_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_EXAM_BLOCK_ITEMS_QUESTION ON assessment_exam_block_items (question_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS assessment_change_journal (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        actor_user_id uuid NULL,
        entity_type varchar(64) NOT NULL,
        entity_id varchar(128) NOT NULL,
        action varchar(64) NOT NULL,
        summary text NOT NULL,
        old_version text NULL,
        new_version text NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_CHANGE_JOURNAL_ACTOR ON assessment_change_journal (actor_user_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_CHANGE_JOURNAL_ENTITY ON assessment_change_journal (entity_type, entity_id)`,
    );

    await queryRunner.query(`
      ALTER TABLE assessment_sections
      ADD COLUMN IF NOT EXISTS description text NULL,
      ADD COLUMN IF NOT EXISTS duration_minutes int NULL,
      ADD COLUMN IF NOT EXISTS level_label varchar(64) NULL,
      ADD COLUMN IF NOT EXISTS source_block_id uuid NULL
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_SECTIONS_SOURCE_BLOCK ON assessment_sections (source_block_id)`,
    );

    await queryRunner.query(`
      ALTER TABLE assessment_blueprint_section_rules
      ADD COLUMN IF NOT EXISTS description text NULL,
      ADD COLUMN IF NOT EXISTS duration_minutes int NULL,
      ADD COLUMN IF NOT EXISTS level_label varchar(64) NULL
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_exams
      ALTER COLUMN blueprint_id DROP NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_blueprint_section_rules
      DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS duration_minutes,
      DROP COLUMN IF EXISTS level_label
    `);
    await queryRunner.query(
      `DROP INDEX IF EXISTS IDX_ASSESSMENT_SECTIONS_SOURCE_BLOCK`,
    );
    await queryRunner.query(`
      ALTER TABLE assessment_sections
      DROP COLUMN IF EXISTS description,
      DROP COLUMN IF EXISTS duration_minutes,
      DROP COLUMN IF EXISTS level_label,
      DROP COLUMN IF EXISTS source_block_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_change_journal`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_exam_block_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS assessment_exam_blocks`);
  }
}
