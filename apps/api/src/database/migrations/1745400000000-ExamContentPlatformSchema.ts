import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Exam Content Platform (ECP) schema + data migrate from exam_academy catalog/content.
 * Learner Academy tables (sessions, favorites, …) remain on exam_academy_*.
 */
export class ExamContentPlatformSchema1745400000000 implements MigrationInterface {
  name = 'ExamContentPlatformSchema1745400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_programs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_program_versions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        program_id uuid NOT NULL REFERENCES exam_content_programs(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_VERSIONS_PROGRAM
      ON exam_content_program_versions (program_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_levels (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        version_id uuid NOT NULL REFERENCES exam_content_program_versions(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (version_id, code)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_LEVELS_VERSION
      ON exam_content_levels (version_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_sections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        level_id uuid NOT NULL REFERENCES exam_content_levels(id) ON DELETE CASCADE,
        section_key varchar(64) NOT NULL,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        default_duration_seconds int,
        default_weight_percent numeric(6,2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (level_id, section_key)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_subsections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        section_id uuid NOT NULL REFERENCES exam_content_sections(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (section_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_topics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        version_id uuid NOT NULL REFERENCES exam_content_program_versions(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (version_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_subtopics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        topic_id uuid NOT NULL REFERENCES exam_content_topics(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (topic_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_types (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        engine_adapter varchar(32) NOT NULL,
        engine_question_type varchar(64),
        answer_shape varchar(32) NOT NULL,
        supports_auto_grade boolean NOT NULL DEFAULT true,
        renderer_key varchar(64) NOT NULL,
        editor_key varchar(64) NOT NULL DEFAULT 'generic',
        preview_key varchar(64),
        status varchar(32) NOT NULL DEFAULT 'active',
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_media_assets (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        kind varchar(32) NOT NULL,
        storage_key text NOT NULL,
        mime varchar(128),
        size_bytes bigint,
        duration_ms int,
        checksum varchar(128),
        title text,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_by_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_MEDIA_KIND_STATUS
      ON exam_content_media_assets (kind, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_groups (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        program_id uuid NOT NULL REFERENCES exam_content_programs(id) ON DELETE RESTRICT,
        version_id uuid NOT NULL REFERENCES exam_content_program_versions(id) ON DELETE RESTRICT,
        level_id uuid NOT NULL REFERENCES exam_content_levels(id) ON DELETE RESTRICT,
        section_id uuid REFERENCES exam_content_sections(id) ON DELETE SET NULL,
        subsection_id uuid REFERENCES exam_content_subsections(id) ON DELETE SET NULL,
        topic_id uuid REFERENCES exam_content_topics(id) ON DELETE SET NULL,
        subtopic_id uuid REFERENCES exam_content_subtopics(id) ON DELETE SET NULL,
        title text NOT NULL,
        passage_text text,
        instructions text,
        status varchar(32) NOT NULL DEFAULT 'draft',
        revision int NOT NULL DEFAULT 1,
        supersedes_group_id uuid,
        edition_family_id uuid,
        author_user_id uuid,
        editor_user_id uuid,
        reviewed_by_user_id uuid,
        reviewed_at timestamptz,
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_GROUPS_LEVEL_STATUS
      ON exam_content_item_groups (level_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_kind varchar(32) NOT NULL DEFAULT 'question',
        engine_content_id uuid NOT NULL,
        program_id uuid NOT NULL REFERENCES exam_content_programs(id) ON DELETE RESTRICT,
        version_id uuid NOT NULL REFERENCES exam_content_program_versions(id) ON DELETE RESTRICT,
        level_id uuid NOT NULL REFERENCES exam_content_levels(id) ON DELETE RESTRICT,
        section_id uuid REFERENCES exam_content_sections(id) ON DELETE SET NULL,
        section_key varchar(64) NOT NULL DEFAULT 'reading',
        subsection_id uuid REFERENCES exam_content_subsections(id) ON DELETE SET NULL,
        topic_id uuid REFERENCES exam_content_topics(id) ON DELETE SET NULL,
        subtopic_id uuid REFERENCES exam_content_subtopics(id) ON DELETE SET NULL,
        group_id uuid REFERENCES exam_content_item_groups(id) ON DELETE SET NULL,
        item_type_code varchar(64) NOT NULL,
        topic text,
        difficulty int NOT NULL DEFAULT 1,
        recommended_time_seconds int,
        stem_search text,
        status varchar(32) NOT NULL DEFAULT 'draft',
        revision int NOT NULL DEFAULT 1,
        supersedes_item_id uuid,
        edition_family_id uuid,
        author_user_id uuid,
        editor_user_id uuid,
        reviewed_by_user_id uuid,
        reviewed_at timestamptz,
        published_at timestamptz,
        external_id varchar(128),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_ITEMS_FILTER
      ON exam_content_items (status, level_id, section_key, item_type_code, difficulty)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_ITEMS_ENGINE
      ON exam_content_items (content_kind, engine_content_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_group_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id uuid NOT NULL REFERENCES exam_content_item_groups(id) ON DELETE CASCADE,
        item_id uuid NOT NULL REFERENCES exam_content_items(id) ON DELETE CASCADE,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (group_id, item_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_vocabulary (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id uuid NOT NULL REFERENCES exam_content_items(id) ON DELETE CASCADE,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_grammar (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id uuid NOT NULL REFERENCES exam_content_items(id) ON DELETE CASCADE,
        pattern text NOT NULL,
        explanation text,
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_media (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        item_id uuid NOT NULL REFERENCES exam_content_items(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES exam_content_media_assets(id) ON DELETE RESTRICT,
        role varchar(32) NOT NULL DEFAULT 'stimulus',
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_group_media (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        group_id uuid NOT NULL REFERENCES exam_content_item_groups(id) ON DELETE CASCADE,
        asset_id uuid NOT NULL REFERENCES exam_content_media_assets(id) ON DELETE RESTRICT,
        role varchar(32) NOT NULL DEFAULT 'stimulus',
        sort_order int NOT NULL DEFAULT 0
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_blueprints (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        level_id uuid NOT NULL REFERENCES exam_content_levels(id) ON DELETE CASCADE,
        name text NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_blueprint_editions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        blueprint_id uuid NOT NULL REFERENCES exam_content_blueprints(id) ON DELETE CASCADE,
        title text NOT NULL,
        revision int NOT NULL DEFAULT 1,
        status varchar(32) NOT NULL DEFAULT 'draft',
        supersedes_edition_id uuid,
        total_duration_seconds int NOT NULL DEFAULT 0,
        scoring_profile_notes text,
        published_at timestamptz,
        created_by_user_id uuid,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_EDITIONS_BP_STATUS
      ON exam_content_blueprint_editions (blueprint_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_edition_sections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        edition_id uuid NOT NULL REFERENCES exam_content_blueprint_editions(id) ON DELETE CASCADE,
        section_key varchar(64) NOT NULL,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        duration_seconds int,
        weight_percent numeric(6,2) NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_edition_blocks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        section_id uuid NOT NULL REFERENCES exam_content_edition_sections(id) ON DELETE CASCADE,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        duration_seconds int,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_selection_rules (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        select_count int NOT NULL DEFAULT 1,
        select_group_count int,
        selection_mode varchar(32) NOT NULL DEFAULT 'random',
        difficulty_min int NOT NULL DEFAULT 1,
        difficulty_max int NOT NULL DEFAULT 5,
        subsection_id uuid REFERENCES exam_content_subsections(id) ON DELETE SET NULL,
        exclude_recent_days int NOT NULL DEFAULT 30,
        deny_duplicate_media boolean NOT NULL DEFAULT true,
        allow_reuse_if_pool_short boolean NOT NULL DEFAULT false,
        max_topic_share_percent numeric(5,2),
        min_mid_difficulty_share_percent numeric(5,2),
        balance_by varchar(32) NOT NULL DEFAULT 'topic',
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_selection_rule_types (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        rule_id uuid NOT NULL REFERENCES exam_content_selection_rules(id) ON DELETE CASCADE,
        item_type_code varchar(64) NOT NULL
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_selection_rule_topics (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        rule_id uuid NOT NULL REFERENCES exam_content_selection_rules(id) ON DELETE CASCADE,
        topic_id uuid NOT NULL REFERENCES exam_content_topics(id) ON DELETE CASCADE
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_edition_block_slots (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        block_id uuid NOT NULL REFERENCES exam_content_edition_blocks(id) ON DELETE CASCADE,
        sort_order int NOT NULL DEFAULT 0,
        slot_kind varchar(32) NOT NULL DEFAULT 'rule',
        selection_rule_id uuid REFERENCES exam_content_selection_rules(id) ON DELETE SET NULL,
        fixed_group_id uuid REFERENCES exam_content_item_groups(id) ON DELETE SET NULL,
        fixed_item_id uuid REFERENCES exam_content_items(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_usage (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        item_id uuid NOT NULL REFERENCES exam_content_items(id) ON DELETE CASCADE,
        group_id uuid REFERENCES exam_content_item_groups(id) ON DELETE SET NULL,
        session_id uuid,
        assessment_attempt_id uuid,
        used_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_USAGE_USER_ITEM_AT
      ON exam_content_item_usage (user_id, item_id, used_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_item_stats (
        item_id uuid PRIMARY KEY REFERENCES exam_content_items(id) ON DELETE CASCADE,
        times_used int NOT NULL DEFAULT 0,
        times_answered int NOT NULL DEFAULT 0,
        times_correct int NOT NULL DEFAULT 0,
        times_wrong int NOT NULL DEFAULT 0,
        avg_answer_time_ms int,
        last_used_at timestamptz,
        difficulty_index numeric(8,4),
        discrimination_index numeric(8,4),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_change_log (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        entity_type varchar(32) NOT NULL,
        entity_id uuid NOT NULL,
        actor_user_id uuid,
        action varchar(64) NOT NULL,
        summary text,
        before_revision int,
        after_revision int,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EC_CHANGE_ENTITY
      ON exam_content_change_log (entity_type, entity_id, created_at DESC)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_permissions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        capability varchar(64) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, capability)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_import_jobs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        status varchar(32) NOT NULL DEFAULT 'pending',
        format varchar(16) NOT NULL,
        created_by_user_id uuid,
        total_rows int NOT NULL DEFAULT 0,
        success_rows int NOT NULL DEFAULT 0,
        error_rows int NOT NULL DEFAULT 0,
        error_summary text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        finished_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_import_job_rows (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        job_id uuid NOT NULL REFERENCES exam_content_import_jobs(id) ON DELETE CASCADE,
        row_number int NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'pending',
        external_id varchar(128),
        item_id uuid,
        error_message text
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_export_jobs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        status varchar(32) NOT NULL DEFAULT 'pending',
        format varchar(16) NOT NULL,
        created_by_user_id uuid,
        storage_key text,
        error_summary text,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        finished_at timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_content_bulk_jobs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        status varchar(32) NOT NULL DEFAULT 'pending',
        action varchar(64) NOT NULL,
        payload_summary text,
        created_by_user_id uuid,
        affected_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        finished_at timestamptz
      )
    `);

    await queryRunner.query(`
      ALTER TABLE exam_academy_sessions
      ADD COLUMN IF NOT EXISTS blueprint_edition_id uuid
    `);

    await queryRunner.query(`
      ALTER TABLE assessment_exams
      DROP CONSTRAINT IF EXISTS CHK_ASSESSMENT_EXAMS_SOURCE
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exams
      ADD CONSTRAINT CHK_ASSESSMENT_EXAMS_SOURCE
      CHECK (source IN ('assessment', 'exam_academy', 'exam_content'))
    `);

    // ---- Data migrate from exam_academy (same UUIDs where possible) ----
    await queryRunner.query(`
      INSERT INTO exam_content_programs (id, code, title, status, created_at, updated_at)
      SELECT id, code, title, status, created_at, updated_at FROM exam_academy_programs
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_program_versions (id, program_id, code, title, sort_order, status, created_at, updated_at)
      SELECT id, program_id, code, title, sort_order, status, created_at, updated_at FROM exam_academy_program_versions
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_levels (id, version_id, code, title, sort_order, status, created_at, updated_at)
      SELECT id, version_id, code, title, sort_order, status, created_at, updated_at FROM exam_academy_levels
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_sections (id, level_id, section_key, title, sort_order, default_duration_seconds, default_weight_percent, created_at, updated_at)
      SELECT id, level_id, section_key, title, sort_order, default_duration_seconds, default_weight_percent, created_at, updated_at
      FROM exam_academy_section_templates
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_item_types (
        id, code, title, engine_adapter, engine_question_type, answer_shape,
        supports_auto_grade, renderer_key, editor_key, preview_key, status, sort_order, created_at, updated_at
      )
      SELECT id, code, title, engine_adapter, engine_question_type, answer_shape,
        supports_auto_grade, renderer_key, code, renderer_key, status, sort_order, created_at, updated_at
      FROM exam_academy_item_types
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_items (
        id, content_kind, engine_content_id, program_id, version_id, level_id, section_id, section_key,
        item_type_code, topic, difficulty, recommended_time_seconds, status, revision,
        supersedes_item_id, author_user_id, published_at, created_at, updated_at, edition_family_id
      )
      SELECT c.id, c.content_kind, c.content_id, c.program_id, c.version_id, c.level_id,
        s.id, c.section_key, c.item_type_code, c.topic, c.difficulty, c.recommended_time_seconds,
        CASE WHEN c.status = 'published' THEN 'published' WHEN c.status = 'archived' THEN 'archived' ELSE 'draft' END,
        c.revision, c.supersedes_item_id, c.author_user_id, c.published_at, c.created_at, c.updated_at, c.id
      FROM exam_academy_content_items c
      LEFT JOIN exam_content_sections s ON s.level_id = c.level_id AND s.section_key = c.section_key
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_item_vocabulary (id, item_id, word, pinyin, translation, explanation, sort_order)
      SELECT id, content_item_id, word, pinyin, translation, explanation, sort_order
      FROM exam_academy_content_vocabulary
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_item_grammar (id, item_id, pattern, explanation, sort_order)
      SELECT id, content_item_id, pattern, explanation, sort_order
      FROM exam_academy_content_grammar
      ON CONFLICT (id) DO NOTHING
    `);

    // Blueprints → blueprint + published edition + sections/blocks/slots from academy mock blueprints
    await queryRunner.query(`
      INSERT INTO exam_content_blueprints (id, level_id, name, status, created_at, updated_at)
      SELECT id, level_id, name, 'active', created_at, updated_at FROM exam_academy_mock_blueprints
      ON CONFLICT (id) DO NOTHING
    `);
    await queryRunner.query(`
      INSERT INTO exam_content_blueprint_editions (
        id, blueprint_id, title, revision, status, supersedes_edition_id,
        total_duration_seconds, published_at, created_at, updated_at
      )
      SELECT id, id, name || ' · v' || revision::text, revision,
        CASE WHEN status = 'published' THEN 'published' WHEN status = 'archived' THEN 'archived' ELSE 'draft' END,
        supersedes_blueprint_id, total_duration_seconds,
        CASE WHEN status = 'published' THEN updated_at ELSE NULL END,
        created_at, updated_at
      FROM exam_academy_mock_blueprints
      ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO exam_content_edition_sections (id, edition_id, section_key, title, sort_order, duration_seconds, weight_percent)
      SELECT bs.id, bs.blueprint_id, COALESCE(st.section_key, 'part'), COALESCE(st.title, 'Part'),
        bs.sort_order, bs.duration_seconds, 0
      FROM exam_academy_mock_blueprint_sections bs
      LEFT JOIN exam_academy_section_templates st ON st.id = bs.section_template_id
      ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      INSERT INTO exam_content_edition_blocks (id, section_id, title, sort_order, duration_seconds)
      SELECT id, id, title, 0, duration_seconds FROM exam_content_edition_sections
      ON CONFLICT (id) DO NOTHING
    `);

    await queryRunner.query(`
      DO $$
      DECLARE r RECORD;
      DECLARE rule_id uuid;
      BEGIN
        FOR r IN
          SELECT bs.id AS section_id, GREATEST(bs.select_count, 1) AS select_count
          FROM exam_academy_mock_blueprint_sections bs
        LOOP
          rule_id := gen_random_uuid();
          INSERT INTO exam_content_selection_rules (id, select_count, selection_mode, balance_by)
          VALUES (rule_id, r.select_count, 'random', 'topic');
          INSERT INTO exam_content_edition_block_slots (block_id, sort_order, slot_kind, selection_rule_id)
          VALUES (r.section_id, 0, 'rule', rule_id);
        END LOOP;
      END $$;
    `);

    await queryRunner.query(`
      INSERT INTO exam_content_permissions (user_id, capability)
      SELECT id, 'exam_content.publish' FROM users WHERE role = 'admin'
      ON CONFLICT (user_id, capability) DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE exam_academy_sessions DROP COLUMN IF EXISTS blueprint_edition_id`);
    const tables = [
      'exam_content_bulk_jobs',
      'exam_content_export_jobs',
      'exam_content_import_job_rows',
      'exam_content_import_jobs',
      'exam_content_permissions',
      'exam_content_change_log',
      'exam_content_item_stats',
      'exam_content_item_usage',
      'exam_content_edition_block_slots',
      'exam_content_selection_rule_topics',
      'exam_content_selection_rule_types',
      'exam_content_selection_rules',
      'exam_content_edition_blocks',
      'exam_content_edition_sections',
      'exam_content_blueprint_editions',
      'exam_content_blueprints',
      'exam_content_group_media',
      'exam_content_item_media',
      'exam_content_item_grammar',
      'exam_content_item_vocabulary',
      'exam_content_group_items',
      'exam_content_items',
      'exam_content_item_groups',
      'exam_content_media_assets',
      'exam_content_item_types',
      'exam_content_subtopics',
      'exam_content_topics',
      'exam_content_subsections',
      'exam_content_sections',
      'exam_content_levels',
      'exam_content_program_versions',
      'exam_content_programs',
    ];
    for (const t of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${t} CASCADE`);
    }
  }
}
