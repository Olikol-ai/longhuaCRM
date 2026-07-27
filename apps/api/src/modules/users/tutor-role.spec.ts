import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { APP_ROLES, isAppRole, normalizeRole } from '../../common/constants/roles';
import {
  DASHBOARD_ROLES,
  getRedirectPath,
  normalizeUserRole,
  toDbRole,
} from '../auth/onboarding';
import { UpdateUserDto } from './dto/update-user.dto';

describe('Tutor role foundation', () => {
  it('includes tutor in APP_ROLES and DASHBOARD_ROLES', () => {
    expect(APP_ROLES).toContain('tutor');
    expect(DASHBOARD_ROLES).toContain('tutor');
    expect(isAppRole('tutor')).toBe(true);
    expect(normalizeRole('tutor')).toBe('tutor');
    expect(normalizeUserRole('tutor')).toBe('tutor');
    expect(toDbRole('tutor')).toBe('tutor');
    expect(getRedirectPath('active', 'tutor')).toBe('/TutorDashboard');
  });

  it('accepts tutor in UpdateUserDto validation', async () => {
    const dto = plainToInstance(UpdateUserDto, { role: 'tutor', status: 'active' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects unknown roles in UpdateUserDto', async () => {
    const dto = plainToInstance(UpdateUserDto, { role: 'superadmin' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'role')).toBe(true);
  });
});
