import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Stage 4 — Web Push + notification event idempotency + preferences.
 * Channel stays varchar-compatible; also extends PG enum if present.
 */
export class WebPushAndNotificationEvents1746300000000 implements MigrationInterface {
  name = 'WebPushAndNotificationEvents1746300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "notifications"
        ADD COLUMN IF NOT EXISTS "event_id" uuid,
        ADD COLUMN IF NOT EXISTS "deep_link" varchar(512),
        ADD COLUMN IF NOT EXISTS "attempt_count" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "last_error" text
    `);

    await queryRunner.query(`
      DO $$
      DECLARE
        enum_name text;
      BEGIN
        SELECT t.typname INTO enum_name
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_type t ON t.oid = a.atttypid
        WHERE c.relname = 'notifications'
          AND a.attname = 'channel'
          AND t.typtype = 'e'
        LIMIT 1;

        IF enum_name IS NOT NULL THEN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_enum e
            JOIN pg_type t ON t.oid = e.enumtypid
            WHERE t.typname = enum_name
              AND e.enumlabel = 'web_push'
          ) THEN
            EXECUTE format('ALTER TYPE %I ADD VALUE %L', enum_name, 'web_push');
          END IF;
        END IF;
      END $$;
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_NOTIFICATION_EVENT_USER_CHANNEL"
        ON "notifications" ("event_id", "user_id", "channel")
        WHERE "event_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_EVENT_ID"
        ON "notifications" ("event_id")
        WHERE "event_id" IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_USER_CREATED"
        ON "notifications" ("user_id", "created_at" DESC)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_USER_READ"
        ON "notifications" ("user_id", "read_at")
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "push_subscriptions" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "endpoint" text NOT NULL,
        "p256dh" text NOT NULL,
        "auth" text NOT NULL,
        "user_agent" varchar(512),
        "device_label" varchar(128),
        "created_at" timestamptz NOT NULL DEFAULT now(),
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        "last_seen_at" timestamptz,
        "revoked_at" timestamptz
      )
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "UQ_PUSH_SUBSCRIPTION_ENDPOINT"
        ON "push_subscriptions" ("endpoint")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_PUSH_SUBSCRIPTION_USER"
        ON "push_subscriptions" ("user_id")
      WHERE "revoked_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "notification_preferences" (
        "id" uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
        "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
        "category" varchar(64) NOT NULL,
        "push_enabled" boolean NOT NULL DEFAULT true,
        "in_app_enabled" boolean NOT NULL DEFAULT true,
        "telegram_enabled" boolean NOT NULL DEFAULT true,
        "updated_at" timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_NOTIFICATION_PREF_USER_CATEGORY" UNIQUE ("user_id", "category")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_NOTIFICATION_PREF_USER"
        ON "notification_preferences" ("user_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "notification_preferences"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "push_subscriptions"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_NOTIFICATION_USER_READ"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_NOTIFICATION_USER_CREATED"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_NOTIFICATION_EVENT_ID"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "UQ_NOTIFICATION_EVENT_USER_CHANNEL"`);
    await queryRunner.query(`
      ALTER TABLE "notifications"
        DROP COLUMN IF EXISTS "last_error",
        DROP COLUMN IF EXISTS "attempt_count",
        DROP COLUMN IF EXISTS "deep_link",
        DROP COLUMN IF EXISTS "event_id"
    `);
  }
}
