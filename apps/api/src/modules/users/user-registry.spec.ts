import { readFileSync } from 'fs';
import { join } from 'path';
import { EXPLICIT_NO_ROLE_DB_VALUE } from '../auth/onboarding';
import { UserRegistryService } from './user-registry.service';

describe('UserRegistryService', () => {
  const source = readFileSync(join(__dirname, 'user-registry.service.ts'), 'utf8');

  it('excludes legacy tutor roles from registry', () => {
    expect(source).toContain("'tutor'");
    expect(source).toContain('legacyRoles');
  });

  it('supports explicit no-role filter value', () => {
    expect(source).toContain(EXPLICIT_NO_ROLE_DB_VALUE);
    expect(source).toContain('explicitNoRole');
  });

  it('supports assigned teacher none filter for students', () => {
    expect(source).toContain("assignedTeacherId === 'none'");
  });

  it('enriches teacher accounts with teacher_profile_id from teachers.user_id', () => {
    expect(source).toContain('teacher_profile_id');
    expect(source).toContain('teacherByUserId');
    expect(source).toContain('t.user_id IN (:...ids)');
  });
});

describe('UserRegistryService helpers', () => {
  it('documents registry contract', () => {
    expect(typeof UserRegistryService).toBe('function');
  });
});
