import * as bcrypt from 'bcryptjs';
import { BadRequestException, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

describe('AuthService.changePassword', () => {
  const userId = 'user-1';
  const currentPlain = 'OldPass1';
  let usersRepository: {
    findById: jest.Mock;
    save: jest.Mock;
  };
  let service: AuthService;

  beforeEach(() => {
    usersRepository = {
      findById: jest.fn(),
      save: jest.fn(async (row) => row),
    };
    service = Object.create(AuthService.prototype) as AuthService;
    Object.assign(service, {
      usersRepository,
      logger: { log: jest.fn(), warn: jest.fn() },
    });
  });

  function mockUser(overrides: Record<string, unknown> = {}) {
    return {
      id: userId,
      passwordHash: bcrypt.hashSync(currentPlain, 10),
      passwordResetToken: 'pending',
      passwordResetExpiresAt: new Date(Date.now() + 60_000),
      ...overrides,
    };
  }

  it('rejects wrong current password', async () => {
    usersRepository.findById.mockResolvedValue(mockUser());
    await expect(
      service.changePassword(userId, {
        current_password: 'Wrong1x',
        new_password: 'NewPass1',
        confirm_password: 'NewPass1',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects mismatched confirm', async () => {
    usersRepository.findById.mockResolvedValue(mockUser());
    await expect(
      service.changePassword(userId, {
        current_password: currentPlain,
        new_password: 'NewPass1',
        confirm_password: 'NewPass2',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects weak new password', async () => {
    usersRepository.findById.mockResolvedValue(mockUser());
    await expect(
      service.changePassword(userId, {
        current_password: currentPlain,
        new_password: 'short',
        confirm_password: 'short',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects same as current password', async () => {
    usersRepository.findById.mockResolvedValue(mockUser());
    await expect(
      service.changePassword(userId, {
        current_password: currentPlain,
        new_password: currentPlain,
        confirm_password: currentPlain,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects missing user', async () => {
    usersRepository.findById.mockResolvedValue(null);
    await expect(
      service.changePassword(userId, {
        current_password: currentPlain,
        new_password: 'NewPass1',
        confirm_password: 'NewPass1',
      }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('hashes new password and clears reset tokens', async () => {
    const row = mockUser();
    usersRepository.findById.mockResolvedValue(row);
    const result = await service.changePassword(userId, {
      current_password: currentPlain,
      new_password: 'NewPass1',
      confirm_password: 'NewPass1',
    });
    expect(result.ok).toBe(true);
    expect(bcrypt.compareSync('NewPass1', row.passwordHash)).toBe(true);
    expect(row.passwordResetToken).toBeNull();
    expect(row.passwordResetExpiresAt).toBeNull();
    expect(usersRepository.save).toHaveBeenCalledWith(row);
  });
});
