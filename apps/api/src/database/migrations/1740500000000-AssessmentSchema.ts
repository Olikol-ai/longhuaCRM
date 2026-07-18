import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * LongHua Assessment bounded-context schema (`assessment_*`).
 * Aligns with docs/assessment/* + confirmed decisions:
 * - Assignment.status (no active boolean)
 * - assessment_banks
 * - assessment_result_breakdowns
 * - assessment_attempt_answer_selections (normalized MC selections)
 */
export class AssessmentSchema1740500000000 implements MigrationInterface {
  name = 'AssessmentSchema1740500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await queryRunner.query(`
      CREATE TABLE "assessment_banks" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "description" text,
        "locale" varchar(16),
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BANKS_STATUS" ON "assessment_banks" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BANKS_CREATED_BY" ON "assessment_banks" ("created_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_topics" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "description" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_TOPICS_NAME" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "assessment_questions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "bank_id" uuid NOT NULL REFERENCES "assessment_banks"("id") ON DELETE CASCADE,
        "type" varchar(32) NOT NULL,
        "stem" text NOT NULL,
        "points" numeric(10,2) NOT NULL DEFAULT 1,
        "difficulty" int NOT NULL DEFAULT 1,
        "explanation" text,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTIONS_BANK_ID" ON "assessment_questions" ("bank_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTIONS_STATUS" ON "assessment_questions" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTIONS_CREATED_BY" ON "assessment_questions" ("created_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_question_topics" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL REFERENCES "assessment_questions"("id") ON DELETE CASCADE,
        "topic_id" uuid NOT NULL REFERENCES "assessment_topics"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_QUESTION_TOPICS" UNIQUE ("question_id", "topic_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTION_TOPICS_QUESTION" ON "assessment_question_topics" ("question_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTION_TOPICS_TOPIC" ON "assessment_question_topics" ("topic_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_answers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL REFERENCES "assessment_questions"("id") ON DELETE CASCADE,
        "text" text NOT NULL,
        "is_correct" boolean NOT NULL DEFAULT false,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ANSWERS_QUESTION_ID" ON "assessment_answers" ("question_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_question_attachments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "question_id" uuid NOT NULL REFERENCES "assessment_questions"("id") ON DELETE CASCADE,
        "kind" varchar(32) NOT NULL,
        "storage_key" text NOT NULL,
        "mime" varchar(128),
        "sort_order" int NOT NULL DEFAULT 0,
        "original_filename" text,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTION_ATTACHMENTS_QUESTION" ON "assessment_question_attachments" ("question_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_exam_templates" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "name" text NOT NULL,
        "description" text,
        "locale" varchar(16),
        "level_label" text,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAM_TEMPLATES_STATUS" ON "assessment_exam_templates" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAM_TEMPLATES_CREATED_BY" ON "assessment_exam_templates" ("created_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_blueprints" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "exam_template_id" uuid NOT NULL REFERENCES "assessment_exam_templates"("id") ON DELETE RESTRICT,
        "bank_id" uuid NOT NULL REFERENCES "assessment_banks"("id") ON DELETE RESTRICT,
        "name" text NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BLUEPRINTS_TEMPLATE_ID" ON "assessment_blueprints" ("exam_template_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BLUEPRINTS_BANK_ID" ON "assessment_blueprints" ("bank_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BLUEPRINTS_STATUS" ON "assessment_blueprints" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BLUEPRINTS_CREATED_BY" ON "assessment_blueprints" ("created_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_blueprint_section_rules" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "blueprint_id" uuid NOT NULL REFERENCES "assessment_blueprints"("id") ON DELETE CASCADE,
        "section_key" varchar(64) NOT NULL,
        "title" text NOT NULL,
        "question_count" int NOT NULL,
        "question_types" text[] NOT NULL DEFAULT '{}',
        "difficulty_min" int NOT NULL DEFAULT 1,
        "difficulty_max" int NOT NULL DEFAULT 5,
        "topic_filter" text,
        "topic_ids" uuid[] NOT NULL DEFAULT '{}',
        "weight" numeric(6,2) NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_BLUEPRINT_SECTION_KEY" UNIQUE ("blueprint_id", "section_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_BLUEPRINT_SECTION_RULES_BP" ON "assessment_blueprint_section_rules" ("blueprint_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_exams" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "blueprint_id" uuid NOT NULL REFERENCES "assessment_blueprints"("id") ON DELETE RESTRICT,
        "name" text NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "available_from" timestamptz,
        "available_to" timestamptz,
        "created_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAMS_BLUEPRINT_ID" ON "assessment_exams" ("blueprint_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAMS_STATUS" ON "assessment_exams" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAMS_CREATED_BY" ON "assessment_exams" ("created_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_rules" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "exam_id" uuid UNIQUE REFERENCES "assessment_exams"("id") ON DELETE CASCADE,
        "duration_minutes" int NOT NULL,
        "max_attempts" int NOT NULL DEFAULT 1,
        "allow_retake" boolean NOT NULL DEFAULT false,
        "retake_policy" varchar(16) NOT NULL DEFAULT 'last',
        "allow_review" boolean NOT NULL DEFAULT false,
        "show_result_after_submit" boolean NOT NULL DEFAULT true,
        "show_correct_answers" varchar(32) NOT NULL DEFAULT 'never',
        "auto_submit_on_timeout" boolean NOT NULL DEFAULT true,
        "allow_pause" boolean NOT NULL DEFAULT false,
        "randomize_questions" boolean NOT NULL DEFAULT false,
        "randomize_answers" boolean NOT NULL DEFAULT false,
        "passing_mode" varchar(16) NOT NULL DEFAULT 'percent',
        "pass_score" numeric(10,2),
        "pass_score_percent" numeric(6,2),
        "allow_navigation" boolean NOT NULL DEFAULT true,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "assessment_sections" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "exam_id" uuid NOT NULL REFERENCES "assessment_exams"("id") ON DELETE CASCADE,
        "section_key" varchar(64) NOT NULL,
        "title" text NOT NULL,
        "weight" numeric(6,2) NOT NULL,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_SECTIONS_EXAM_KEY" UNIQUE ("exam_id", "section_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_SECTIONS_EXAM_ID" ON "assessment_sections" ("exam_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_exam_questions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "exam_id" uuid NOT NULL REFERENCES "assessment_exams"("id") ON DELETE CASCADE,
        "section_id" uuid NOT NULL REFERENCES "assessment_sections"("id") ON DELETE CASCADE,
        "question_id" uuid NOT NULL REFERENCES "assessment_questions"("id") ON DELETE RESTRICT,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_EXAM_QUESTIONS" UNIQUE ("exam_id", "question_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAM_QUESTIONS_EXAM" ON "assessment_exam_questions" ("exam_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAM_QUESTIONS_SECTION" ON "assessment_exam_questions" ("section_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_EXAM_QUESTIONS_QUESTION" ON "assessment_exam_questions" ("question_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_exam_assignments" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "exam_id" uuid NOT NULL REFERENCES "assessment_exams"("id") ON DELETE CASCADE,
        "target_type" varchar(32) NOT NULL,
        "target_id" uuid NOT NULL,
        "status" varchar(32) NOT NULL DEFAULT 'draft',
        "valid_from" timestamptz,
        "valid_to" timestamptz,
        "assessment_rule_override_id" uuid REFERENCES "assessment_rules"("id") ON DELETE SET NULL,
        "assigned_by_user_id" uuid,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ASSIGNMENTS_EXAM_ID" ON "assessment_exam_assignments" ("exam_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ASSIGNMENTS_TARGET" ON "assessment_exam_assignments" ("target_type", "target_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ASSIGNMENTS_STATUS" ON "assessment_exam_assignments" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ASSIGNMENTS_ASSIGNED_BY" ON "assessment_exam_assignments" ("assigned_by_user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_attempts" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "exam_id" uuid NOT NULL REFERENCES "assessment_exams"("id") ON DELETE CASCADE,
        "assignment_id" uuid REFERENCES "assessment_exam_assignments"("id") ON DELETE SET NULL,
        "status" varchar(32) NOT NULL DEFAULT 'created',
        "submit_reason" varchar(16),
        "attempt_number" int NOT NULL,
        "student_id" uuid,
        "teacher_id" uuid,
        "user_id" uuid NOT NULL,
        "started_at" timestamptz,
        "expires_at" timestamptz,
        "submitted_at" timestamptz,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "CHK_ASSESSMENT_ATTEMPTS_PARTICIPANT" CHECK (
          NOT (student_id IS NOT NULL AND teacher_id IS NOT NULL)
        )
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPTS_EXAM_ID" ON "assessment_attempts" ("exam_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPTS_ASSIGNMENT_ID" ON "assessment_attempts" ("assignment_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPTS_STATUS" ON "assessment_attempts" ("status")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPTS_STUDENT_ID" ON "assessment_attempts" ("student_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPTS_TEACHER_ID" ON "assessment_attempts" ("teacher_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPTS_USER_ID" ON "assessment_attempts" ("user_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_question_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "attempt_id" uuid NOT NULL REFERENCES "assessment_attempts"("id") ON DELETE CASCADE,
        "source_question_id" uuid,
        "section_key" varchar(64) NOT NULL,
        "type" varchar(32) NOT NULL,
        "stem" text NOT NULL,
        "points" numeric(10,2) NOT NULL,
        "difficulty" int NOT NULL DEFAULT 1,
        "explanation" text,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_QUESTION_SNAPSHOTS_ATTEMPT" ON "assessment_question_snapshots" ("attempt_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_answer_snapshots" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "question_snapshot_id" uuid NOT NULL REFERENCES "assessment_question_snapshots"("id") ON DELETE CASCADE,
        "source_answer_id" uuid,
        "text" text NOT NULL,
        "is_correct" boolean NOT NULL DEFAULT false,
        "sort_order" int NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ANSWER_SNAPSHOTS_Q" ON "assessment_answer_snapshots" ("question_snapshot_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_attempt_answers" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "attempt_id" uuid NOT NULL REFERENCES "assessment_attempts"("id") ON DELETE CASCADE,
        "question_snapshot_id" uuid NOT NULL REFERENCES "assessment_question_snapshots"("id") ON DELETE CASCADE,
        "text_answer" text,
        "is_correct" boolean,
        "score" numeric(10,2),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_ATTEMPT_ANSWERS" UNIQUE ("attempt_id", "question_snapshot_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPT_ANSWERS_ATTEMPT" ON "assessment_attempt_answers" ("attempt_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPT_ANSWERS_Q_SNAP" ON "assessment_attempt_answers" ("question_snapshot_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_attempt_answer_selections" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "attempt_answer_id" uuid NOT NULL REFERENCES "assessment_attempt_answers"("id") ON DELETE CASCADE,
        "answer_snapshot_id" uuid NOT NULL REFERENCES "assessment_answer_snapshots"("id") ON DELETE CASCADE,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_ATTEMPT_ANSWER_SEL" UNIQUE ("attempt_answer_id", "answer_snapshot_id")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPT_ANSWER_SEL_AA" ON "assessment_attempt_answer_selections" ("attempt_answer_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_ATTEMPT_ANSWER_SEL_AS" ON "assessment_attempt_answer_selections" ("answer_snapshot_id")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_results" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "attempt_id" uuid NOT NULL UNIQUE REFERENCES "assessment_attempts"("id") ON DELETE CASCADE,
        "exam_id" uuid NOT NULL REFERENCES "assessment_exams"("id") ON DELETE CASCADE,
        "status" varchar(32) NOT NULL DEFAULT 'processing',
        "evaluation_type" varchar(16) NOT NULL,
        "score" numeric(10,2) NOT NULL DEFAULT 0,
        "max_score" numeric(10,2) NOT NULL DEFAULT 0,
        "percent" numeric(6,2) NOT NULL DEFAULT 0,
        "passed" boolean NOT NULL DEFAULT false,
        "started_at" timestamptz,
        "finished_at" timestamptz,
        "duration" int,
        "attempt_number" int NOT NULL,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now()
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_RESULTS_EXAM_ID" ON "assessment_results" ("exam_id")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_RESULTS_STATUS" ON "assessment_results" ("status")`,
    );

    await queryRunner.query(`
      CREATE TABLE "assessment_result_breakdowns" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "result_id" uuid NOT NULL REFERENCES "assessment_results"("id") ON DELETE CASCADE,
        "section_key" varchar(64) NOT NULL,
        "weight" numeric(6,2) NOT NULL,
        "score" numeric(10,2) NOT NULL DEFAULT 0,
        "max_score" numeric(10,2) NOT NULL DEFAULT 0,
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_ASSESSMENT_RESULT_BREAKDOWNS" UNIQUE ("result_id", "section_key")
      )
    `);
    await queryRunner.query(
      `CREATE INDEX "IDX_ASSESSMENT_RESULT_BREAKDOWNS_RESULT" ON "assessment_result_breakdowns" ("result_id")`,
    );

    // Optional CRM FKs (SET NULL) when tables exist
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'users') THEN
          BEGIN
            ALTER TABLE "assessment_banks"
              ADD CONSTRAINT "FK_assessment_banks_created_by"
              FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
          BEGIN
            ALTER TABLE "assessment_questions"
              ADD CONSTRAINT "FK_assessment_questions_created_by"
              FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
          BEGIN
            ALTER TABLE "assessment_exam_templates"
              ADD CONSTRAINT "FK_assessment_exam_templates_created_by"
              FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
          BEGIN
            ALTER TABLE "assessment_blueprints"
              ADD CONSTRAINT "FK_assessment_blueprints_created_by"
              FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
          BEGIN
            ALTER TABLE "assessment_exams"
              ADD CONSTRAINT "FK_assessment_exams_created_by"
              FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
          BEGIN
            ALTER TABLE "assessment_exam_assignments"
              ADD CONSTRAINT "FK_assessment_assignments_assigned_by"
              FOREIGN KEY ("assigned_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
          BEGIN
            ALTER TABLE "assessment_attempts"
              ADD CONSTRAINT "FK_assessment_attempts_user_id"
              FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'students') THEN
          BEGIN
            ALTER TABLE "assessment_attempts"
              ADD CONSTRAINT "FK_assessment_attempts_student_id"
              FOREIGN KEY ("student_id") REFERENCES "students"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;

        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'teachers') THEN
          BEGIN
            ALTER TABLE "assessment_attempts"
              ADD CONSTRAINT "FK_assessment_attempts_teacher_id"
              FOREIGN KEY ("teacher_id") REFERENCES "teachers"("id") ON DELETE SET NULL;
          EXCEPTION WHEN duplicate_object THEN NULL;
          END;
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_result_breakdowns"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_results"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_attempt_answer_selections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_attempt_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_answer_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_question_snapshots"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_attempts"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_exam_assignments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_exam_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_sections"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_exams"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_blueprint_section_rules"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_blueprints"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_exam_templates"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_question_attachments"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_answers"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_question_topics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_questions"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_topics"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "assessment_banks"`);
  }
}
