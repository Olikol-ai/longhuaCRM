import { readFileSync } from 'fs';
import { join } from 'path';

describe('UserDeletionService SQL contract', () => {
  const source = readFileSync(join(__dirname, 'user-deletion.service.ts'), 'utf8');

  it('uses the real exam_content_item_usage table, not the plural typo', () => {
    expect(source).toContain("exam_content_item_usage");
    expect(source).not.toContain('exam_content_item_usages');
  });

  it('does not DELETE historical assessment or homework attempts', () => {
    expect(source).not.toMatch(/DELETE FROM assessment_attempts/);
    expect(source).not.toMatch(/DELETE FROM homework_attempts/);
  });

  it('nullifies sales diary manager references before delete', () => {
    expect(source).toContain('sales_diary_entries');
    expect(source).toContain('organization_deals');
  });

  it('cleans pending_registrations when deleting a user by email', () => {
    expect(source).toContain('deletePendingRegistrationsByEmail');
    expect(source).toMatch(/DELETE FROM pending_registrations WHERE LOWER\(email\)/);
  });

  it('exposes deletePendingRegistration for incomplete registrations', () => {
    expect(source).toContain('deletePendingRegistration');
    expect(source).toMatch(/DELETE FROM pending_registrations WHERE id/);
  });

  it('nullifies assessment exam authorship before user delete', () => {
    expect(source).toContain('assessment_exams');
    expect(source).toContain('assessment_questions');
  });

  it('does not DELETE B2B receipts or commission accruals', () => {
    expect(source).not.toMatch(/DELETE FROM organization_receipts/);
    expect(source).not.toMatch(/DELETE FROM sales_commission_accruals/);
    expect(source).not.toMatch(/DELETE FROM organizations /);
  });
});
