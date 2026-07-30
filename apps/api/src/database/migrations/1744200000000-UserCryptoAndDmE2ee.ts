import { MigrationInterface, QueryRunner } from 'typeorm';

export class UserCryptoAndDmE2ee1744200000000 implements MigrationInterface {
  name = 'UserCryptoAndDmE2ee1744200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS user_crypto (
        user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        public_key text NOT NULL,
        wrapped_private_key text NOT NULL,
        wrap_salt text NOT NULL,
        wrap_iv text NOT NULL,
        algorithm varchar(64) NOT NULL DEFAULT 'x25519-aes256gcm-v1',
        kdf varchar(32) NOT NULL DEFAULT 'pbkdf2-sha256',
        kdf_iterations integer NOT NULL DEFAULT 310000,
        key_version integer NOT NULL DEFAULT 1,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      ALTER TABLE chat_messages
        ADD COLUMN IF NOT EXISTS ciphertext text NULL,
        ADD COLUMN IF NOT EXISTS nonce text NULL,
        ADD COLUMN IF NOT EXISTS encryption_algorithm varchar(64) NULL,
        ADD COLUMN IF NOT EXISTS key_version integer NULL
    `);

    // Legacy Direct plaintext must not remain readable on the server.
    await queryRunner.query(`
      UPDATE chat_messages m
      SET body = NULL
      FROM chats c
      WHERE m.chat_id = c.id
        AND c.kind = 'direct'
        AND m.body IS NOT NULL
        AND m.type = 'text'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE chat_messages
        DROP COLUMN IF EXISTS ciphertext,
        DROP COLUMN IF EXISTS nonce,
        DROP COLUMN IF EXISTS encryption_algorithm,
        DROP COLUMN IF EXISTS key_version
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS user_crypto`);
  }
}
