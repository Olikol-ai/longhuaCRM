import { ForbiddenException } from '@nestjs/common';
import { B2bAccessService } from './b2b-access.service';

describe('B2B ACL', () => {
  const access = new B2bAccessService();
  const admin = { sub: 'admin-id', email: 'a@test.local', role: 'admin' };
  const managerA = { sub: 'mgr-a', email: 'a@test.local', role: 'sales_manager' };
  const managerB = { sub: 'mgr-b', email: 'b@test.local', role: 'sales_manager' };
  const teacher = { sub: 't-id', email: 't@test.local', role: 'teacher' };

  it('allows admin to access B2B', () => {
    expect(() => access.assertCanAccessB2b(admin)).not.toThrow();
  });

  it('allows sales manager to access B2B', () => {
    expect(() => access.assertCanAccessB2b(managerA)).not.toThrow();
  });

  it('denies teacher B2B access', () => {
    expect(() => access.assertCanAccessB2b(teacher)).toThrow(ForbiddenException);
  });

  it('manager can read own organization only', () => {
    expect(() => access.assertCanReadOrganization(managerA, 'mgr-a')).not.toThrow();
    expect(() => access.assertCanReadOrganization(managerA, 'mgr-b')).toThrow(ForbiddenException);
  });

  it('admin can read any organization', () => {
    expect(() => access.assertCanReadOrganization(admin, 'mgr-b')).not.toThrow();
  });
});
