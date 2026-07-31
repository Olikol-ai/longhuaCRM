import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Subject system chats: active flag, teacher/tutor subject links,
 * seed catalog subjects, one SUBJECT chat per subject, course→subject backfill.
 */
export class SubjectSystemChats1744500000000 implements MigrationInterface {
  name = 'SubjectSystemChats1744500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE subjects
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true
    `);

    await queryRunner.query(`
      ALTER TABLE user_subjects
      ADD COLUMN IF NOT EXISTS source varchar(32) NOT NULL DEFAULT 'manual'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS teacher_subjects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (teacher_id, subject_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_TEACHER_SUBJECTS_TEACHER
      ON teacher_subjects (teacher_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_TEACHER_SUBJECTS_SUBJECT
      ON teacher_subjects (subject_id)
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS tutor_subjects (
        id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        tutor_id uuid NOT NULL REFERENCES tutors(id) ON DELETE CASCADE,
        subject_id uuid NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
        created_at timestamptz NOT NULL DEFAULT NOW(),
        UNIQUE (tutor_id, subject_id)
      )
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_TUTOR_SUBJECTS_TUTOR
      ON tutor_subjects (tutor_id)
    `);
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS IDX_TUTOR_SUBJECTS_SUBJECT
      ON tutor_subjects (subject_id)
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS UQ_CHATS_SUBJECT_KIND
      ON chats (subject_id)
      WHERE kind = 'subject' AND subject_id IS NOT NULL
    `);

    // Catalog subjects
    await queryRunner.query(`
      INSERT INTO subjects (id, name, slug, description, is_active)
      SELECT uuid_generate_v4(), v.name, v.slug, v.description, true
      FROM (VALUES
        ('Китайский язык', 'chinese', 'Основной предмет Longhua Academy'),
        ('Английский язык', 'english', 'Английский язык'),
        ('Математика', 'math', 'Математика'),
        ('Физика', 'physics', 'Физика'),
        ('История', 'history', 'История')
      ) AS v(name, slug, description)
      WHERE NOT EXISTS (SELECT 1 FROM subjects s WHERE s.slug = v.slug)
    `);

    // Ensure Chinese name is canonical
    await queryRunner.query(`
      UPDATE subjects
      SET name = 'Китайский язык', is_active = true
      WHERE slug = 'chinese'
    `);

    // Link all course templates to Chinese when they have no subject yet
    await queryRunner.query(`
      INSERT INTO course_subjects (id, course_template_id, subject_id)
      SELECT uuid_generate_v4(), ct.id, s.id
      FROM course_templates ct
      CROSS JOIN subjects s
      WHERE s.slug = 'chinese'
        AND NOT EXISTS (
          SELECT 1 FROM course_subjects cs WHERE cs.course_template_id = ct.id
        )
    `);

    // Default teaching subject for existing teachers/tutors: Chinese
    await queryRunner.query(`
      INSERT INTO teacher_subjects (id, teacher_id, subject_id)
      SELECT uuid_generate_v4(), t.id, s.id
      FROM teachers t
      CROSS JOIN subjects s
      WHERE s.slug = 'chinese'
        AND t.status = 'active'
        AND NOT EXISTS (
          SELECT 1 FROM teacher_subjects ts WHERE ts.teacher_id = t.id
        )
    `);
    await queryRunner.query(`
      INSERT INTO tutor_subjects (id, tutor_id, subject_id)
      SELECT uuid_generate_v4(), t.id, s.id
      FROM tutors t
      CROSS JOIN subjects s
      WHERE s.slug = 'chinese'
        AND t.status IN ('active', 'pending')
        AND NOT EXISTS (
          SELECT 1 FROM tutor_subjects ts WHERE ts.tutor_id = t.id
        )
    `);

    // One SUBJECT chat per active subject; title = 📚 {name}
    await queryRunner.query(`
      INSERT INTO chats (id, kind, subject_id, title, description, status)
      SELECT
        uuid_generate_v4(),
        'subject',
        s.id,
        CASE
          WHEN s.name LIKE '📚%' THEN s.name
          ELSE '📚 ' || s.name
        END,
        'Системный чат предмета',
        'active'
      FROM subjects s
      WHERE s.is_active = true
        AND NOT EXISTS (
          SELECT 1 FROM chats c
          WHERE c.kind = 'subject' AND c.subject_id = s.id
        )
    `);

    await queryRunner.query(`
      UPDATE chats c
      SET title = CASE
        WHEN s.name LIKE '📚%' THEN s.name
        ELSE '📚 ' || s.name
      END,
      description = COALESCE(c.description, 'Системный чат предмета')
      FROM subjects s
      WHERE c.kind = 'subject'
        AND c.subject_id = s.id
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX IF EXISTS UQ_CHATS_SUBJECT_KIND`);
    await queryRunner.query(`DROP TABLE IF EXISTS tutor_subjects`);
    await queryRunner.query(`DROP TABLE IF EXISTS teacher_subjects`);
    await queryRunner.query(`
      ALTER TABLE user_subjects DROP COLUMN IF EXISTS source
    `);
    await queryRunner.query(`
      ALTER TABLE subjects DROP COLUMN IF EXISTS is_active
    `);
  }
}
