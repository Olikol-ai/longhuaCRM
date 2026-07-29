import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { DirectChatRequestStatus } from './enums/chat.enums';
import { DirectChatRequestService } from './services/direct-chat-request.service';

describe('DirectChatRequestService', () => {
  function build() {
    const requests = {
      findOne: jest.fn(),
      save: jest.fn(async (row: Record<string, unknown>) => ({
        id: 'req-1',
        createdAt: new Date(),
        ...row,
      })),
      find: jest.fn(),
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      })),
    };
    const members = {
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 2 }),
      })),
    };
    const users = {
      findOne: jest.fn().mockResolvedValue({
        id: 'from',
        firstName: 'Иван',
        lastName: 'Иванов',
        email: 'ivan@test.local',
        telegramId: null,
      }),
    };
    const privacy = {
      assertCanReceiveDmRequest: jest.fn().mockResolvedValue(undefined),
      assertNotBlocked: jest.fn().mockResolvedValue(undefined),
      computeExpiresAt: jest.fn(() => new Date(Date.now() + 86400000)),
    };
    const membershipSync = {
      findOrCreateDirect: jest.fn().mockResolvedValue({
        id: 'chat-1',
        kind: 'direct',
      }),
    };
    const notifications = {
      create: jest.fn().mockResolvedValue({ id: 'n1' }),
    };
    const telegram = {
      sendMessage: jest.fn().mockResolvedValue(undefined),
    };
    const gateway = {
      emitToUser: jest.fn(),
    };

    const service = new DirectChatRequestService(
      requests as never,
      members as never,
      users as never,
      privacy as never,
      membershipSync as never,
      notifications as never,
      telegram as never,
      gateway as never,
    );

    return {
      service,
      requests,
      members,
      privacy,
      membershipSync,
      notifications,
      telegram,
      gateway,
    };
  }

  it('create leaves pending request without creating a chat', async () => {
    const { service, requests, membershipSync, gateway, notifications } = build();
    requests.findOne
      .mockResolvedValueOnce(null) // pending check
      .mockResolvedValueOnce({
        id: 'req-1',
        fromUserId: 'from',
        toUserId: 'to',
        status: DirectChatRequestStatus.Pending,
        createdChatId: null,
      });

    const row = await service.create(
      { sub: 'from', email: 'from@test.local', role: 'student' },
      'to',
      'Привет',
    );

    expect(membershipSync.findOrCreateDirect).not.toHaveBeenCalled();
    expect(row.createdChatId).toBeNull();
    expect(row.status).toBe(DirectChatRequestStatus.Pending);
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'to',
      'chat.request.created',
      expect.objectContaining({ id: 'req-1' }),
    );
    // notify is fire-and-forget; allow microtask
    await Promise.resolve();
    expect(notifications.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'to',
        type: 'direct_chat_request',
        referenceType: 'direct_chat_request',
      }),
    );
  });

  it('accept creates exactly one direct chat and sets createdChatId', async () => {
    const { service, requests, membershipSync, gateway } = build();
    requests.findOne
      .mockResolvedValueOnce({
        id: 'req-1',
        fromUserId: 'from',
        toUserId: 'to',
        status: DirectChatRequestStatus.Pending,
        createdChatId: null,
      })
      .mockResolvedValueOnce({
        id: 'req-1',
        fromUserId: 'from',
        toUserId: 'to',
        status: DirectChatRequestStatus.Accepted,
        createdChatId: 'chat-1',
      });

    const saved = await service.accept(
      { sub: 'to', email: 'to@test.local', role: 'teacher' },
      'req-1',
    );

    expect(membershipSync.findOrCreateDirect).toHaveBeenCalledTimes(1);
    expect(membershipSync.findOrCreateDirect).toHaveBeenCalledWith('from', 'to');
    expect(requests.save).toHaveBeenCalledWith(
      expect.objectContaining({
        status: DirectChatRequestStatus.Accepted,
        createdChatId: 'chat-1',
      }),
    );
    expect(saved.createdChatId).toBe('chat-1');
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'from',
      'chat.request.accepted',
      expect.any(Object),
    );
    expect(gateway.emitToUser).toHaveBeenCalledWith('from', 'chat.created', expect.any(Object));
  });

  it('decline rejects non-recipient', async () => {
    const { service, requests } = build();
    requests.findOne.mockResolvedValue({
      id: 'req-1',
      fromUserId: 'from',
      toUserId: 'to',
      status: DirectChatRequestStatus.Pending,
    });
    await expect(
      service.decline({ sub: 'from', email: 'from@test.local', role: 'student' }, 'req-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('cancel rejects non-sender', async () => {
    const { service, requests } = build();
    requests.findOne.mockResolvedValue({
      id: 'req-1',
      fromUserId: 'from',
      toUserId: 'to',
      status: DirectChatRequestStatus.Pending,
    });
    await expect(
      service.cancel({ sub: 'to', email: 'to@test.local', role: 'teacher' }, 'req-1'),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects second pending for same pair', async () => {
    const { service, requests } = build();
    requests.findOne.mockResolvedValue({
      id: 'existing',
      status: DirectChatRequestStatus.Pending,
    });
    await expect(
      service.create({ sub: 'from', email: 'from@test.local', role: 'student' }, 'to'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('expirePending marks overdue rows expired', async () => {
    const { service, requests } = build();
    const affected = await service.expirePending();
    expect(affected).toBe(2);
    expect(requests.createQueryBuilder).toHaveBeenCalled();
  });
});
