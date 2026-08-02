import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Remove unused content review workflow: in_review → draft.
 * Teachers publish directly; no multi-person approval.
 */
export class DropExamContentInReview1745600000000 implements MigrationInterface {
  name = 'DropExamContentInReview1745600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE exam_content_items SET status = 'draft' WHERE status = 'in_review'
    `);
    await queryRunner.query(`
      UPDATE exam_content_item_groups SET status = 'draft' WHERE status = 'in_review'
    `);
    await queryRunner.query(`
      UPDATE exam_content_blueprint_editions SET status = 'draft' WHERE status = 'in_review'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Non-destructive: cannot restore which drafts were formerly in_review.
    void queryRunner;
  }
}
