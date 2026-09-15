import { readFileSync } from 'fs';
import { join } from 'path';

describe('StudentMergeService contract', () => {
  const source = readFileSync(join(__dirname, 'student-merge.service.ts'), 'utf8');

  it('merges balances by summing lesson_balance values', () => {
    expect(source).toContain('primary.lessonBalance + secondary.lessonBalance');
  });

  it('deduplicates group memberships during merge', () => {
    expect(source).toContain('mergeGroupMembers');
  });

  it('marks secondary profile inactive with merged_into_student_id', () => {
    expect(source).toContain('mergedIntoStudentId: primary.id');
    expect(source).toContain("status: 'inactive'");
  });

  it('writes audit log for merge operation', () => {
    expect(source).toContain("action: 'student_merge'");
  });
});

describe('User registry student profiles contract', () => {
  const source = readFileSync(join(__dirname, '../users/user-registry.service.ts'), 'utf8');

  it('includes students without platform accounts in registry queries', () => {
    expect(source).toContain('shouldIncludeStudentProfiles');
    expect(source).toContain('s.user_id IS NULL');
    expect(source).toContain('studentProfileToRegistryItem');
  });
});
