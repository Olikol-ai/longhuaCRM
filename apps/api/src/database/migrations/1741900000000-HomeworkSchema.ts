import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Homework module tables — separate from assessment_exam_*.
 * Questions reuse assessment_questions via homework_items.question_id.
 */
export class HomeworkSchema1741900000000 implements MigrationInterface {
  name = 'HomeworkSchema1741900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homeworks (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        title text NOT NULL,
        description text NULL,
        instructions text NULL,
        status varchar(32) NOT NULL DEFAULT 'draft',
        activity_kind varchar(32) NOT NULL DEFAULT 'test',
        teacher_id uuid NULL,
        created_by_user_id uuid NOT NULL,
        pass_score_percent numeric(5,2) NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORKS_STATUS ON homeworks (status)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORKS_TEACHER ON homeworks (teacher_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORKS_CREATED_BY ON homeworks (created_by_user_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_items (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        homework_id uuid NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
        question_id uuid NOT NULL REFERENCES assessment_questions(id) ON DELETE RESTRICT,
        section_key varchar(64) NOT NULL DEFAULT 'test',
        sort_order int NOT NULL DEFAULT 0,
        points numeric(10,2) NULL,
        passage_text text NULL,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ITEMS_HOMEWORK ON homework_items (homework_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ITEMS_QUESTION ON homework_items (question_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_assignments (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        homework_id uuid NOT NULL REFERENCES homeworks(id) ON DELETE CASCADE,
        student_id uuid NOT NULL,
        assigned_by_user_id uuid NOT NULL,
        lesson_id uuid NULL,
        status varchar(32) NOT NULL DEFAULT 'assigned',
        due_at timestamptz NULL,
        assigned_at timestamptz NOT NULL DEFAULT NOW(),
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ASSIGNMENTS_HOMEWORK ON homework_assignments (homework_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ASSIGNMENTS_STUDENT ON homework_assignments (student_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ASSIGNMENTS_STATUS ON homework_assignments (status)`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS UQ_HOMEWORK_ASSIGNMENTS_HW_STUDENT
       ON homework_assignments (homework_id, student_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_attempts (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        assignment_id uuid NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
        homework_id uuid NOT NULL,
        student_id uuid NOT NULL,
        user_id uuid NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'started',
        started_at timestamptz NOT NULL,
        submitted_at timestamptz NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ATTEMPTS_ASSIGNMENT ON homework_attempts (assignment_id)`,
    );
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ATTEMPTS_STUDENT ON homework_attempts (student_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_question_snapshots (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        attempt_id uuid NOT NULL REFERENCES homework_attempts(id) ON DELETE CASCADE,
        source_question_id uuid NULL,
        section_key varchar(64) NOT NULL,
        type varchar(32) NOT NULL,
        stem text NOT NULL,
        points numeric(10,2) NOT NULL,
        difficulty int NOT NULL DEFAULT 1,
        explanation text NULL,
        passage_text text NULL,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_QSNAP_ATTEMPT ON homework_question_snapshots (attempt_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_answer_snapshots (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        question_snapshot_id uuid NOT NULL REFERENCES homework_question_snapshots(id) ON DELETE CASCADE,
        source_answer_id uuid NULL,
        body text NOT NULL,
        is_correct boolean NOT NULL DEFAULT false,
        sort_order int NOT NULL DEFAULT 0,
        created_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ASNAP_QSNAP ON homework_answer_snapshots (question_snapshot_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_attempt_answers (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        attempt_id uuid NOT NULL REFERENCES homework_attempts(id) ON DELETE CASCADE,
        question_snapshot_id uuid NOT NULL REFERENCES homework_question_snapshots(id) ON DELETE CASCADE,
        text_answer text NULL,
        earned_points numeric(10,2) NULL,
        is_correct boolean NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (attempt_id, question_snapshot_id)
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_ATTEMPT_ANSWERS_ATTEMPT ON homework_attempt_answers (attempt_id)`,
    );

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_attempt_answer_selections (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        attempt_answer_id uuid NOT NULL REFERENCES homework_attempt_answers(id) ON DELETE CASCADE,
        answer_snapshot_id uuid NOT NULL REFERENCES homework_answer_snapshots(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (attempt_answer_id, answer_snapshot_id)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS homework_results (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        attempt_id uuid NOT NULL UNIQUE REFERENCES homework_attempts(id) ON DELETE CASCADE,
        assignment_id uuid NOT NULL,
        score numeric(10,2) NOT NULL DEFAULT 0,
        max_score numeric(10,2) NOT NULL DEFAULT 0,
        percent numeric(5,2) NOT NULL DEFAULT 0,
        passed boolean NOT NULL DEFAULT false,
        evaluation_type varchar(32) NOT NULL,
        status varchar(32) NOT NULL DEFAULT 'reviewed',
        duration_seconds int NULL,
        breakdown_json text NULL,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        updated_at timestamptz NOT NULL DEFAULT NOW()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX IF NOT EXISTS IDX_HOMEWORK_RESULTS_ASSIGNMENT ON homework_results (assignment_id)`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS homework_results`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_attempt_answer_selections`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_attempt_answers`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_answer_snapshots`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_question_snapshots`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_attempts`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_assignments`);
    await queryRunner.query(`DROP TABLE IF EXISTS homework_items`);
    await queryRunner.query(`DROP TABLE IF EXISTS homeworks`);
  }
}
