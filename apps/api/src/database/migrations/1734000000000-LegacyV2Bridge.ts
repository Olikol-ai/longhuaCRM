import { MigrationInterface, QueryRunner } from 'typeorm';
import { alignLegacyTablesForV2 } from '../migration-helpers';

/**
 * Idempotent bridge for databases that already ran legacy migrations.
 * Safe no-op on fresh v2 installs (alignLegacyTablesForV2 checks column existence).
 */
export class LegacyV2Bridge1734000000000 implements MigrationInterface {
  name = 'LegacyV2Bridge1734000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await alignLegacyTablesForV2(queryRunner);
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Non-destructive bridge — no automatic rollback of added columns.
  }
}
