import { ChatKind } from './enums/chat.enums';
import { ChatsService } from './services/chats.service';

describe('ChatsService.markUnread', () => {
  function build() {
    const member = {
      chatId: 'chat-1',
      userId: 'user-1',
      lastReadMessageId: 'msg-2' as string | null,
      lastReadAt: new Date('2026-08-15T12:00:00Z') as Date | null,
    };
    const older = {
      id: 'msg-1',
      chatId: 'chat-1',
      createdAt: new Date('2026-08-15T11:00:00Z'),
      senderUserId: 'user-2',
    };
    const latest = {
      id: 'msg-2',
      chatId: 'chat-1',
      createdAt: new Date('2026-08-15T12:00:00Z'),
      senderUserId: 'user-2',
    };

    let qbCalls = 0;
    const messageRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        qb.where = jest.fn().mockReturnValue(qb);
        qb.andWhere = jest.fn().mockReturnValue(qb);
        qb.orderBy = jest.fn().mockReturnValue(qb);
        qb.addOrderBy = jest.fn().mockReturnValue(qb);
        qb.getOne = jest.fn(async () => {
          qbCalls += 1;
          return qbCalls === 1 ? latest : older;
        });
        qb.getCount = jest.fn().mockResolvedValue(1);
        qb.select = jest.fn().mockReturnValue(qb);
        qb.getMany = jest.fn().mockResolvedValue([]);
        return qb;
      }),
      findOne: jest.fn(),
    };

    const memberRepo = {
      findOne: jest.fn(async () => ({ ...member })),
      update: jest.fn(async (_where, patch) => {
        Object.assign(member, patch);
        return { affected: 1 };
      }),
      find: jest.fn(),
      save: jest.fn(),
    };

    const membershipSync = {
      addMember: jest.fn(async () => member),
      ensureForUser: jest.fn(),
    };
    const access = {
      assertCanRead: jest.fn().mockResolvedValue({ id: 'chat-1', kind: ChatKind.Direct }),
      isAdmin: jest.fn().mockReturnValue(false),
    };
    const gateway = { emitToUser: jest.fn() };

    const service = new ChatsService(
      { find: jest.fn(), createQueryBuilder: jest.fn() } as never,
      memberRepo as never,
      messageRepo as never,
      { find: jest.fn(), exists: jest.fn(), save: jest.fn(), delete: jest.fn() } as never,
      { createQueryBuilder: jest.fn() } as never,
      { upsert: jest.fn(), findOneOrFail: jest.fn() } as never,
      access as never,
      membershipSync as never,
      { countOnline: jest.fn().mockReturnValue(0) } as never,
      gateway as never,
    );

    jest.spyOn(service, 'unreadSummary').mockResolvedValue({ total: 1, byChat: { 'chat-1': 1 } });

    return { service, membershipSync, memberRepo, access, member, gateway };
  }

  const actor = { sub: 'user-1', email: 'a@test', role: 'student' };

  it('rewinds last_read before latest peer message and emits unread', async () => {
    const { service, membershipSync, memberRepo, member, gateway, access } = build();
    const result = await service.markUnread(actor, 'chat-1');
    expect(access.assertCanRead).toHaveBeenCalledWith(actor, 'chat-1');
    expect(membershipSync.addMember).toHaveBeenCalledWith('chat-1', 'user-1');
    expect(memberRepo.update).toHaveBeenCalledWith(
      { chatId: 'chat-1', userId: 'user-1' },
      expect.objectContaining({ lastReadMessageId: 'msg-1' }),
    );
    expect(member.lastReadMessageId).toBe('msg-1');
    expect(result.lastReadMessageId).toBe('msg-1');
    expect(gateway.emitToUser).toHaveBeenCalledWith('user-1', 'chat.unread', expect.any(Object));
  });
});
