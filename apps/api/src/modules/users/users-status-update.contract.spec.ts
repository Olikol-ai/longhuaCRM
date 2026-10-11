import { readFileSync } from 'fs';
import { join } from 'path';

describe('UsersService status update contract', () => {
  const source = readFileSync(join(__dirname, 'users.service.ts'), 'utf8');

  it('does not force status=active when dto.status is explicitly provided', () => {
    expect(source).toMatch(/if \(dto\.status === undefined\) \{\s*row\.status = 'active';/);
    expect(source).not.toMatch(
      /includes\(String\(dto\.role\)\)\s*\) \{\s*row\.status = 'active';/,
    );
  });

  it('still clears verification tokens when resulting status is active', () => {
    expect(source).toMatch(/if \(row\.status === 'active'\) \{\s*row\.verificationCode = null;/);
  });
});
