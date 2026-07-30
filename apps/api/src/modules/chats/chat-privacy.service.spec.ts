import { ForbiddenException, HttpException } from '@nestjs/common';
import { ChatPrivacyService } from '../../common/access/chat-privacy.service';
import { DmPrivacyPolicy } from './enums/chat.enums';

describe('ChatPrivacyService rate limits and policy', () => {
  function build(overrides: Record<string, unknown> = {}) {
    const privacyRepo = {
      findOne: jest.fn().mockResolvedValue({
        userId: 'to',
        dmPolicy: DmPrivacyPolicy.AllRegistered,
      }),
      save: jest.fn(),
      update: jest.fn(),
    };
    const blockRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
      })),
      find: jest.fn(),
      findOne: jest.fn(),
      save: jest.fn(),
      delete: jest.fn(),
    };
    const requestRepo = {
      count: jest.fn().mockResolvedValue(0),
      findOne: jest.fn().mockResolvedValue(null),
    };
    const userRepo = {
      findOne: jest.fn().mockImplementation(async ({ where }: { where: { id: string } }) => ({
        id: where.id,
        role: 'student',
        status: 'active',
        email: `${where.id}@test.local`,
      })),
    };
    const empty = { findOne: jest.fn(), exists: jest.fn(), createQueryBuilder: jest.fn() };
    const config = {
      get: jest.fn((key: string, def?: string) => {
        const map: Record<string, string> = {
          CHAT_DM_REQUESTS_PER_DAY: '10',
          CHAT_DM_REQUESTS_PER_PAIR_30D: '3',
          CHAT_DM_DECLINE_COOLDOWN_DAYS: '7',
          CHAT_DM_REQUEST_TTL_DAYS: '14',
        };
        return map[key] ?? def;
      }),
    };
    const service = new ChatPrivacyService(
      config as never,
      privacyRepo as never,
      blockRepo as never,
      requestRepo as never,
      userRepo as never,
      (overrides.students as never) ?? (empty as never),
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
      empty as never,
    );
    return { service, privacyRepo, blockRepo, requestRepo, userRepo };
  }

  it('denies nobody policy', async () => {
    const { service, privacyRepo } = build();
    privacyRepo.findOne.mockResolvedValue({
      userId: 'to',
      dmPolicy: DmPrivacyPolicy.Nobody,
    });
    await expect(service.assertCanReceiveDmRequest('from', 'to')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('enforces daily rate limit', async () => {
    const { service, requestRepo } = build();
    requestRepo.count.mockResolvedValueOnce(10);
    await expect(service.assertCanReceiveDmRequest('from', 'to')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('enforces pair rate limit over 30 days', async () => {
    const { service, requestRepo } = build();
    requestRepo.count
      .mockResolvedValueOnce(0) // day
      .mockResolvedValueOnce(3); // pair 30d
    await expect(service.assertCanReceiveDmRequest('from', 'to')).rejects.toBeInstanceOf(
      HttpException,
    );
  });

  it('enforces decline cooldown', async () => {
    const { service, requestRepo } = build();
    requestRepo.count.mockResolvedValue(0);
    requestRepo.findOne.mockImplementation(async ({ where }: { where: { status?: string } }) => {
      if (where?.status === 'pending') return null;
      if (where?.status === 'declined') {
        return {
          id: 'old',
          status: 'declined',
          respondedAt: new Date(),
        };
      }
      return null;
    });
    await expect(service.assertCanReceiveDmRequest('from', 'to')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('defaults policy by role', () => {
    const { service } = build();
    expect(service.defaultPolicyForRole('admin')).toBe(DmPrivacyPolicy.AllRegistered);
    expect(service.defaultPolicyForRole('teacher')).toBe(DmPrivacyPolicy.MyStudents);
    expect(service.defaultPolicyForRole('student')).toBe(DmPrivacyPolicy.MyTeachers);
  });

  it('directory canRequest ignores daily rate limit', async () => {
    const { service, requestRepo } = build();
    requestRepo.count.mockResolvedValue(10);
    const result = await service.canRequest('from', 'to');
    expect(result.canRequest).toBe(true);
    expect(result.code).toBe('ok');
  });

  it('create path still enforces daily rate limit', async () => {
    const { service, requestRepo } = build();
    requestRepo.count.mockResolvedValueOnce(10);
    await expect(service.assertCanReceiveDmRequest('from', 'to')).rejects.toBeInstanceOf(
      HttpException,
    );
  });
});
