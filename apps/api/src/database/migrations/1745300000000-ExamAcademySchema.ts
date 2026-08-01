import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Universal Exam Academy schema (HSK Academy is the first product skin).
 * Also marks Assessment exams that are Academy materializations.
 */
export class ExamAcademySchema1745300000000 implements MigrationInterface {
  name = 'ExamAcademySchema1745300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE assessment_exams
      ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'assessment'
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_ASSESSMENT_EXAMS_SOURCE
      ON assessment_exams (source)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_programs (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_program_versions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        program_id uuid NOT NULL REFERENCES exam_academy_programs(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        sort_order int NOT NULL DEFAULT 0,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_VERSIONS_PROGRAM
      ON exam_academy_program_versions (program_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_levels (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        version_id uuid NOT NULL REFERENCES exam_academy_program_versions(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS IDX_EA_LEVELS_VERSION
      ON exam_academy_levels (version_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_item_types (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        engine_adapter varchar(32) NOT NULL,
        engine_question_type varchar(64),
        answer_shape varchar(32) NOT NULL,
        supports_auto_grade boolean NOT NULL DEFAULT true,
        renderer_key varchar(64) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'active',
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_section_templates (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        level_id uuid NOT NULL REFERENCES exam_academy_levels(id) ON DELETE CASCADE,
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
      CREATE INDEX IF NOT EXISTS IDX_EA_SECTION_TEMPLATES_LEVEL
      ON exam_academy_section_templates (level_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_section_template_item_types (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        section_template_id uuid NOT NULL
          REFERENCES exam_academy_section_templates(id) ON DELETE CASCADE,
        item_type_code varchar(64) NOT NULL
          REFERENCES exam_academy_item_types(code) ON DELETE RESTRICT,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (section_template_id, item_type_code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_scoring_profiles (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        level_id uuid NOT NULL REFERENCES exam_academy_levels(id) ON DELETE CASCADE,
        code varchar(64) NOT NULL,
        title text NOT NULL,
        passing_mode varchar(32) NOT NULL DEFAULT 'percent',
        pass_score numeric(10,2),
        pass_score_percent numeric(6,2),
        grader_kind varchar(32) NOT NULL DEFAULT 'auto',
        auto_grade boolean NOT NULL DEFAULT true,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (level_id, code)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_scoring_profile_sections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        scoring_profile_id uuid NOT NULL
          REFERENCES exam_academy_scoring_profiles(id) ON DELETE CASCADE,
        section_key varchar(64) NOT NULL,
        weight_percent numeric(6,2) NOT NULL DEFAULT 0,
        minimum_percent numeric(6,2),
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (scoring_profile_id, section_key)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_mock_blueprints (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        level_id uuid NOT NULL REFERENCES exam_academy_levels(id) ON DELETE CASCADE,
        scoring_profile_id uuid
          REFERENCES exam_academy_scoring_profiles(id) ON DELETE SET NULL,
        name text NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'draft',
        revision int NOT NULL DEFAULT 1,
        total_duration_seconds int NOT NULL DEFAULT 0,
        supersedes_blueprint_id uuid
          REFERENCES exam_academy_mock_blueprints(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_BLUEPRINTS_LEVEL
      ON exam_academy_mock_blueprints (level_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_mock_blueprint_sections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        blueprint_id uuid NOT NULL
          REFERENCES exam_academy_mock_blueprints(id) ON DELETE CASCADE,
        section_template_id uuid NOT NULL
          REFERENCES exam_academy_section_templates(id) ON DELETE RESTRICT,
        select_count int NOT NULL DEFAULT 1,
        sort_order int NOT NULL DEFAULT 0,
        duration_seconds int,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_content_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_kind varchar(32) NOT NULL,
        content_id uuid NOT NULL,
        program_id uuid NOT NULL REFERENCES exam_academy_programs(id) ON DELETE RESTRICT,
        version_id uuid NOT NULL REFERENCES exam_academy_program_versions(id) ON DELETE RESTRICT,
        level_id uuid NOT NULL REFERENCES exam_academy_levels(id) ON DELETE RESTRICT,
        section_key varchar(64) NOT NULL,
        item_type_code varchar(64) NOT NULL
          REFERENCES exam_academy_item_types(code) ON DELETE RESTRICT,
        topic text,
        difficulty int NOT NULL DEFAULT 1,
        recommended_time_seconds int,
        author_user_id uuid,
        status varchar(32) NOT NULL DEFAULT 'draft',
        revision int NOT NULL DEFAULT 1,
        supersedes_item_id uuid
          REFERENCES exam_academy_content_items(id) ON DELETE SET NULL,
        published_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_CONTENT_LEVEL_SECTION
      ON exam_academy_content_items (level_id, section_key)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_CONTENT_KIND_ID
      ON exam_academy_content_items (content_kind, content_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_CONTENT_STATUS
      ON exam_academy_content_items (status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_content_vocabulary (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_item_id uuid NOT NULL
          REFERENCES exam_academy_content_items(id) ON DELETE CASCADE,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_CONTENT_VOCAB_ITEM
      ON exam_academy_content_vocabulary (content_item_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_content_grammar (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        content_item_id uuid NOT NULL
          REFERENCES exam_academy_content_items(id) ON DELETE CASCADE,
        pattern text NOT NULL,
        explanation text,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_CONTENT_GRAMMAR_ITEM
      ON exam_academy_content_grammar (content_item_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_sessions (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        mode varchar(32) NOT NULL,
        program_version_id uuid NOT NULL
          REFERENCES exam_academy_program_versions(id) ON DELETE RESTRICT,
        level_id uuid NOT NULL REFERENCES exam_academy_levels(id) ON DELETE RESTRICT,
        section_key varchar(64),
        question_count int,
        randomize boolean NOT NULL DEFAULT true,
        show_correct_answers varchar(32) NOT NULL DEFAULT 'after_submit',
        created_by_user_id uuid NOT NULL,
        student_id uuid,
        assigned_by_user_id uuid,
        assessment_exam_id uuid REFERENCES assessment_exams(id) ON DELETE SET NULL,
        assessment_assignment_id uuid,
        scoring_profile_id uuid
          REFERENCES exam_academy_scoring_profiles(id) ON DELETE SET NULL,
        blueprint_id uuid
          REFERENCES exam_academy_mock_blueprints(id) ON DELETE SET NULL,
        status varchar(32) NOT NULL DEFAULT 'draft',
        title text NOT NULL DEFAULT '',
        started_at timestamptz,
        completed_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_SESSIONS_USER
      ON exam_academy_sessions (created_by_user_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_SESSIONS_STUDENT
      ON exam_academy_sessions (student_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_SESSIONS_STATUS
      ON exam_academy_sessions (status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_session_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id uuid NOT NULL
          REFERENCES exam_academy_sessions(id) ON DELETE CASCADE,
        assessment_attempt_id uuid NOT NULL UNIQUE
          REFERENCES assessment_attempts(id) ON DELETE CASCADE,
        attempt_number int NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_SESSION_ATTEMPTS_SESSION
      ON exam_academy_session_attempts (session_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_favorites (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        content_kind varchar(32) NOT NULL,
        content_id uuid NOT NULL,
        content_item_id uuid
          REFERENCES exam_academy_content_items(id) ON DELETE SET NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, content_kind, content_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_review_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        content_kind varchar(32) NOT NULL,
        content_id uuid NOT NULL,
        content_item_id uuid
          REFERENCES exam_academy_content_items(id) ON DELETE SET NULL,
        source_attempt_id uuid,
        wrong_count int NOT NULL DEFAULT 1,
        last_wrong_at timestamptz NOT NULL DEFAULT NOW(),
        next_review_at timestamptz,
        mastered_at timestamptz,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, content_kind, content_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_REVIEW_USER_STATUS
      ON exam_academy_review_items (user_id, status)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_personal_words (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        word text NOT NULL,
        pinyin text,
        translation text,
        explanation text,
        note text,
        source_content_kind varchar(32),
        source_content_id uuid,
        status varchar(32) NOT NULL DEFAULT 'saved',
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_EA_PERSONAL_WORDS_USER
      ON exam_academy_personal_words (user_id)
    `);
    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_EA_PERSONAL_WORDS_USER_WORD_PINYIN
      ON exam_academy_personal_words (user_id, word, COALESCE(pinyin, ''))
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_achievements (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        code varchar(64) NOT NULL UNIQUE,
        title text NOT NULL,
        description text,
        icon_key varchar(64),
        sort_order int NOT NULL DEFAULT 0,
        status varchar(32) NOT NULL DEFAULT 'active',
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_user_achievements (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        achievement_id uuid NOT NULL
          REFERENCES exam_academy_achievements(id) ON DELETE CASCADE,
        earned_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, achievement_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS exam_academy_user_stats_daily (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        user_id uuid NOT NULL,
        day date NOT NULL,
        program_version_id uuid
          REFERENCES exam_academy_program_versions(id) ON DELETE SET NULL,
        level_id uuid REFERENCES exam_academy_levels(id) ON DELETE SET NULL,
        practice_count int NOT NULL DEFAULT 0,
        mock_count int NOT NULL DEFAULT 0,
        avg_percent numeric(6,2) NOT NULL DEFAULT 0,
        best_percent numeric(6,2) NOT NULL DEFAULT 0,
        total_duration_seconds int NOT NULL DEFAULT 0,
        error_count int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (user_id, day, program_version_id, level_id)
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tables = [
      'exam_academy_user_stats_daily',
      'exam_academy_user_achievements',
      'exam_academy_achievements',
      'exam_academy_personal_words',
      'exam_academy_review_items',
      'exam_academy_favorites',
      'exam_academy_session_attempts',
      'exam_academy_sessions',
      'exam_academy_content_grammar',
      'exam_academy_content_vocabulary',
      'exam_academy_content_items',
      'exam_academy_mock_blueprint_sections',
      'exam_academy_mock_blueprints',
      'exam_academy_scoring_profile_sections',
      'exam_academy_scoring_profiles',
      'exam_academy_section_template_item_types',
      'exam_academy_section_templates',
      'exam_academy_item_types',
      'exam_academy_levels',
      'exam_academy_program_versions',
      'exam_academy_programs',
    ];
    for (const table of tables) {
      await queryRunner.query(`DROP TABLE IF EXISTS ${table} CASCADE`);
    }
    await queryRunner.query(`
      DROP INDEX IF EXISTS IDX_ASSESSMENT_EXAMS_SOURCE
    `);
    await queryRunner.query(`
      ALTER TABLE assessment_exams DROP COLUMN IF EXISTS source
    `);
  }
}
