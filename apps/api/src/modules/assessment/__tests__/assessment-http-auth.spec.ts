import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

function mockContext(user: { sub: string; role: string } | null): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
    getHandler: () => ({}),
    getClass: () => ({}),
  } as unknown as ExecutionContext;
}

describe('Assessment HTTP unauthorized access', () => {
  it('denies request without JWT user', () => {
    const guard = new JwtAuthGuard();
    expect(() => guard.handleRequest(null, null as never)).toThrow(UnauthorizedException);
  });

  it('denies missing user for role-protected assessment routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin', 'teacher']),
    } as unknown as Reflector;
    const rolesGuard = new RolesGuard(reflector);

    expect(() => rolesGuard.canActivate(mockContext(null))).toThrow(UnauthorizedException);
    expect(reflector.getAllAndOverride).toHaveBeenCalledWith(ROLES_KEY, expect.any(Array));
  });

  it('denies insufficient role on assessment authoring routes', () => {
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue(['admin', 'teacher']),
    } as unknown as Reflector;
    const rolesGuard = new RolesGuard(reflector);

    expect(() =>
      rolesGuard.canActivate(mockContext({ sub: 'u-1', role: 'student' })),
    ).toThrow(ForbiddenException);
  });
});
