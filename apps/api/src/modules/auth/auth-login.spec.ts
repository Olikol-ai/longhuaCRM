import * as bcrypt from 'bcryptjs';
import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService.login', () => {
  const clientIp = '127.0.0.1';
  const email = 'admin@longhua.local';
  const password = 'CorrectPass1!';

  let usersRepository: {
    findByEmail: jest.Mock;
    findById: jest.Mock;
  };
  let pendingRepository: {
    findByEmail: jest.Mock;
  };
  let rateLimit: {
    assertAllowed: jest.Mock;
    reset: jest.Mock;
  };
  let userProfileService: {
    resolveProfiles: jest.Mock;
    toProfileFields: jest.Mock;
  };
  let jwtService: { sign: jest.Mock };
  let service: AuthService;

  beforeEach(() => {
    usersRepository = {
      findByEmail: jest.fn(),
      findById: jest.fn(),
    };
    pendingRepository = {
      findByEmail: jest.fn().mockResolvedValue(null),
    };
    rateLimit = {
      assertAllowed: jest.fn(),
      reset: jest.fn(),
    };
    userProfileService = {
      resolveProfiles: jest.fn().mockResolvedValue({}),
      toProfileFields: jest.fn().mockReturnValue({}),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('jwt-token'),
    };

    service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service, {
      usersRepository,
      pendingRepository,
      rateLimit,
      userProfileService,
      jwtService,
    });
  });

  function activeAdminRow(overrides: Record<string, unknown> = {}) {
    const now = new Date();
    return {
      id: 'admin-id',
      email,
      role: 'admin',
      status: 'active',
      emailVerified: true,
      passwordHash: bcrypt.hashSync(password, 10),
      firstName: 'Admin',
      lastName: 'Longhua',
      createdDate: now,
      updatedDate: now,
      ...overrides,
    };
  }

  it('returns JWT for valid email and password', async () => {
    usersRepository.findByEmail.mockResolvedValue(activeAdminRow());

    const result = await service.login(
      { email: `  ${email.toUpperCase()}  `, password },
      clientIp,
    );

    expect(usersRepository.findByEmail).toHaveBeenCalledWith(email);
    expect(rateLimit.reset).toHaveBeenCalledWith(`login-ip:${clientIp}`);
    expect(rateLimit.reset).toHaveBeenCalledWith(`login:${email}`);
    expect(result.token).toBe('jwt-token');
    expect((result.user as { role?: string }).role).toBe('admin');
  });

  it('rejects wrong password without changing the user row', async () => {
    usersRepository.findByEmail.mockResolvedValue(activeAdminRow());

    await expect(
      service.login({ email, password: 'WrongPass1!' }, clientIp),
    ).rejects.toBeInstanceOf(UnauthorizedException);

    expect(rateLimit.reset).not.toHaveBeenCalled();
  });

  it('rejects unknown email', async () => {
    usersRepository.findByEmail.mockResolvedValue(null);

    await expect(
      service.login({ email: 'missing@example.com', password }, clientIp),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejects blocked accounts after password check', async () => {
    usersRepository.findByEmail.mockResolvedValue(
      activeAdminRow({ status: 'blocked' }),
    );

    await expect(
      service.login({ email, password }, clientIp),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('applies rate limiting before lookup', async () => {
    usersRepository.findByEmail.mockResolvedValue(activeAdminRow());

    await service.login({ email, password }, clientIp);

    expect(rateLimit.assertAllowed).toHaveBeenCalledWith(
      `login-ip:${clientIp}`,
      5,
      15 * 60 * 1000,
    );
    expect(rateLimit.assertAllowed).toHaveBeenCalledWith(
      `login:${email}`,
      5,
      15 * 60 * 1000,
    );
  });
});
