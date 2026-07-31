import { ChatKind } from './enums/chat.enums';
import { ChatsService } from './services/chats.service';

describe('ChatsService.markRead', () => {
  function build() {
    const member = {
      chatId: 'chat-1',
      userId: 'user-1',
      lastReadMessageId: null as string | null,
      lastReadAt: null as Date | null,
      hiddenAt: null as Date | null,
    };
    const latest = {
      id: 'msg-latest',
      chatId: 'chat-1',
      createdAt: new Date('2026-07-30T20:36:02.722Z'),
      senderUserId: 'user-2',
    };
    const older = {
      id: 'msg-old',
      chatId: 'chat-1',
      createdAt: new Date('2026-07-30T20:29:59.784Z'),
      senderUserId: 'user-2',
    };

    const memberRepo = {
      findOne: jest.fn(async () => ({ ...member })),
      save: jest.fn(async (row) => {
        Object.assign(member, row);
        return row;
      }),
      update: jest.fn(async (_where, patch) => {
        Object.assign(member, patch);
        return { affected: 1 };
      }),
      find: jest.fn().mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]),
    };
    const messageRepo = {
      findOne: jest.fn(async ({ where, order }: { where: Record<string, unknown>; order?: unknown }) => {
        if (where.id === latest.id) return latest;
        if (where.id === older.id) return older;
        if (order) return latest;
        return null;
      }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        qb.select = jest.fn().mockReturnValue(qb);
        qb.where = jest.fn().mockReturnValue(qb);
        qb.andWhere = jest.fn().mockReturnValue(qb);
        qb.getMany = jest.fn().mockResolvedValue([{ id: older.id }, { id: latest.id }]);
        qb.getCount = jest.fn().mockResolvedValue(0);
        return qb;
      }),
    };
    const receiptRepo = {
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        qb.insert = jest.fn().mockReturnValue(qb);
        qb.into = jest.fn().mockReturnValue(qb);
        qb.values = jest.fn().mockReturnValue(qb);
        qb.orIgnore = jest.fn().mockReturnValue(qb);
        qb.execute = jest.fn().mockResolvedValue({});
        return qb;
      }),
    };
    const membershipSync = {
      addMember: jest.fn(async () => member),
      ensureForUser: jest.fn(),
    };
    const access = {
      assertCanRead: jest.fn().mockResolvedValue({ id: 'chat-1', kind: ChatKind.SchoolCommunity }),
      isAdmin: jest.fn().mockReturnValue(false),
    };
    const presence = { countOnline: jest.fn().mockReturnValue(0) };
    const gateway = { emitToUser: jest.fn() };

    const service = new ChatsService(
      { find: jest.fn(), createQueryBuilder: jest.fn() } as never,
      memberRepo as never,
      messageRepo as never,
      { find: jest.fn(), exists: jest.fn(), save: jest.fn(), delete: jest.fn() } as never,
      receiptRepo as never,
      { upsert: jest.fn(), findOneOrFail: jest.fn() } as never,
      access as never,
      membershipSync as never,
      presence as never,
      gateway as never,
    );

    jest.spyOn(service, 'unreadSummary').mockResolvedValue({ total: 0, byChat: {} });

    return { service, memberRepo, membershipSync, member, latest, older, gateway, messageRepo };
  }

  const actor = { sub: 'user-1', email: 'a@test', role: 'student' };

  it('ensures membership and persists last_read via update() for system chats', async () => {
    const { service, membershipSync, memberRepo, latest, member } = build();
    const result = await service.markRead(actor, 'chat-1', latest.id);
    expect(membershipSync.addMember).toHaveBeenCalledWith('chat-1', 'user-1');
    expect(memberRepo.update).toHaveBeenCalledWith(
      { chatId: 'chat-1', userId: 'user-1' },
      expect.objectContaining({
        lastReadMessageId: latest.id,
        lastReadAt: latest.createdAt,
        hiddenAt: null,
      }),
    );
    expect(memberRepo.save).not.toHaveBeenCalled();
    expect(member.lastReadMessageId).toBe(latest.id);
    expect(result.lastReadMessageId).toBe(latest.id);
    expect(result.unreadCount).toBe(0);
  });

  it('marks up to latest message when messageId is omitted', async () => {
    const { service, member, latest, memberRepo } = build();
    const result = await service.markRead(actor, 'chat-1', null);
    expect(memberRepo.update).toHaveBeenCalled();
    expect(result.lastReadMessageId).toBe(latest.id);
    expect(member.lastReadMessageId).toBe(latest.id);
  });

  it('does not move the cursor backwards', async () => {
    const { service, member, latest, older, memberRepo } = build();
    member.lastReadMessageId = latest.id;
    member.lastReadAt = latest.createdAt;
    const result = await service.markRead(actor, 'chat-1', older.id);
    expect(result.lastReadMessageId).toBe(latest.id);
    expect(memberRepo.update).not.toHaveBeenCalled();
  });

  it('advances past an existing cursor when a newer message is read', async () => {
    const { service, member, latest, older, memberRepo } = build();
    member.lastReadMessageId = older.id;
    member.lastReadAt = older.createdAt;
    const result = await service.markRead(actor, 'chat-1', latest.id);
    expect(memberRepo.update).toHaveBeenCalledWith(
      { chatId: 'chat-1', userId: 'user-1' },
      expect.objectContaining({ lastReadMessageId: latest.id }),
    );
    expect(result.lastReadMessageId).toBe(latest.id);
    expect(result.unreadCount).toBe(0);
  });
});
