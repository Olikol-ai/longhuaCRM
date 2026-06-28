import { MigrationInterface, QueryRunner } from 'typeorm';

export class ShopItemsTable1730000000005 implements MigrationInterface {
  name = 'ShopItemsTable1730000000005';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "shop_items" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "item_id" text NOT NULL,
        "label" text NOT NULL,
        "lessons" integer NOT NULL DEFAULT 1,
        "price" numeric(10,2) NOT NULL DEFAULT 0,
        "note" text,
        "description" text,
        "type" text NOT NULL DEFAULT 'package',
        "sort_order" integer NOT NULL DEFAULT 0,
        "is_active" boolean NOT NULL DEFAULT true,
        "created_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        "updated_date" TIMESTAMPTZ NOT NULL DEFAULT now(),
        CONSTRAINT "PK_shop_items" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_shop_items_item_id" UNIQUE ("item_id")
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SHOP_ITEM_ITEM_ID" ON "shop_items" ("item_id")
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_SHOP_ITEM_SORT_ORDER" ON "shop_items" ("sort_order")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "shop_items"`);
  }
}
