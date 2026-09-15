import { readFileSync } from 'fs';
import { join } from 'path';

describe('TeachersService directory SSOT', () => {
  const source = readFileSync(join(__dirname, 'teachers.service.ts'), 'utf8');

  it('findAll uses canonical active directory query for admin and students', () => {
    expect(source).toContain('buildActiveDirectoryQuery');
    expect(source).toContain('return this.findActive()');
    expect(source).toMatch(/role === 'student'\)[\s\S]*return this\.findActive\(\)/);
  });

  it('requires linked active user with role teacher', () => {
    expect(source).toContain("u.role = :role', { role: 'teacher' }");
    expect(source).toContain("u.status = :userStatus', { userStatus: 'active' }");
  });
});
