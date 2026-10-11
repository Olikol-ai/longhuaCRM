import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { UsersService } from './users.service';
import { UserEntity } from './entities/user.entity';

describe('UsersService.update status persistence', () => {
  const actor = { sub: 'admin-id', role: 'admin', email: 'admin@test.local' };

  function makeService(row: UserEntity) {
    const saved: UserEntity[] = [];
    const userRepo = {
      findOne: jest.fn().mockResolvedValue(row),
      save: jest.fn(async (entity: UserEntity) => {
        saved.push({ ...entity });
        return entity;
      }),
    };
    const manager = {
      getRepository: jest.fn().mockReturnValue(userRepo),
    };
    const dataSource = {
      transaction: jest.fn(async (fn: (m: typeof manager) => Promise<unknown>) => fn(manager)),
    };
    const audit = { log: jest.fn().mockResolvedValue(undefined) };
    const roleEntitySync = {
      syncAfterRoleChange: jest.fn().mockResolvedValue(undefined),
      syncLinkedProfilesFromUser: jest.fn().mockResolvedValue(undefined),
    };

    const service = Object.create(UsersService.prototype) as UsersService;
    Object.assign(service, {
      dataSource,
      audit,
      roleEntitySync,
      deletion: {},
      registryService: {},
    });

    return { service, userRepo, saved, audit, roleEntitySync };
  }

  function studentRow(overrides: Partial<UserEntity> = {}): UserEntity {
    const now = new Date();
    return {
      id: 'student-user-id',
      email: 'student@test.local',
      passwordHash: 'hash',
      role: 'student',
      status: 'active',
      emailVerified: true,
      verificationCode: null,
      verificationAttempts: 0,
      verificationCodeExpiresAt: null,
      verificationCodeSentAt: null,
      firstName: 'Иван',
      lastName: 'Иванов',
      phone: '',
      telegramId: '',
      telegramUsername: '',
      telegramConnectedAt: null,
      telegramLinkToken: null,
      telegramLinkExpires: null,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      telegramNotify24h: true,
      telegramNotify3h: true,
      avatarFilePath: null,
      avatarThumbPath: null,
      avatarUpdatedAt: null,
      createdDate: now,
      updatedDate: now,
      ...overrides,
    } as UserEntity;
  }

  it('keeps explicit blocked when role is also sent (UserEditDialog payload)', async () => {
    const row = studentRow();
    const { service, saved, audit } = makeService(row);

    const result = await service.update(
      row.id,
      { role: 'student', status: 'blocked', firstName: 'Иван', lastName: 'Иванов' },
      actor as never,
    );

    expect(saved[0].status).toBe('blocked');
    expect(result.status).toBe('blocked');
    expect(audit.log).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'status_change',
        summary: 'status: "active" → "blocked"',
      }),
    );
  });

  it('restores active when admin unblocks while keeping role', async () => {
    const row = studentRow({ status: 'blocked' });
    const { service, saved } = makeService(row);

    const result = await service.update(
      row.id,
      { role: 'student', status: 'active' },
      actor as never,
    );

    expect(saved[0].status).toBe('active');
    expect(result.status).toBe('active');
  });

  it('auto-activates when role is assigned without explicit status', async () => {
    const row = studentRow({ status: 'pending', role: '' });
    const { service, saved } = makeService(row);

    await service.update(row.id, { role: 'student' }, actor as never);

    expect(saved[0].status).toBe('active');
    expect(saved[0].role).toBe('student');
  });

  it('rejects blocked update fields', async () => {
    const { service } = makeService(studentRow());
    await expect(
      service.update('student-user-id', { email: 'x@y.z' } as never, actor as never),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('throws when user is missing', async () => {
    const { service, userRepo } = makeService(studentRow());
    userRepo.findOne.mockResolvedValue(null);
    await expect(
      service.update('missing', { status: 'blocked' }, actor as never),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
