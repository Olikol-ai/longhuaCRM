import { ChatKind } from './enums/chat.enums';
import { ChatsService } from './services/chats.service';

/**
 * End-to-end unread contract (mocked repos):
 * A sends → B unread=1 → B markRead → unread=0.
 */
describe('ChatsService unread flow', () => {
  it('clears unread after recipient opens the chat', async () => {
    const chatId = 'chat-dm';
    const senderId = 'user-a';
    const readerId = 'user-b';
    const message = {
      id: 'msg-1',
      chatId,
      createdAt: new Date('2026-07-31T10:00:00.000Z'),
      senderUserId: senderId,
    };

    const readerMember = {
      chatId,
      userId: readerId,
      lastReadMessageId: null as string | null,
      lastReadAt: null as Date | null,
      hiddenAt: null as Date | null,
    };

    let unreadAfterCursor = 1;

    const memberRepo = {
      findOne: jest.fn(async () => ({ ...readerMember })),
      update: jest.fn(async (_where, patch) => {
        Object.assign(readerMember, patch);
        unreadAfterCursor = 0;
        return { affected: 1 };
      }),
      find: jest.fn().mockResolvedValue([{ userId: senderId }, { userId: readerId }]),
      save: jest.fn(),
    };

    const messageRepo = {
      findOne: jest.fn(async ({ where, order }: { where: Record<string, unknown>; order?: unknown }) => {
        if (where.id === message.id) return message;
        if (order) return message;
        return null;
      }),
      createQueryBuilder: jest.fn(() => {
        const qb: Record<string, jest.Mock> = {};
        qb.select = jest.fn().mockReturnValue(qb);
        qb.where = jest.fn().mockReturnValue(qb);
        qb.andWhere = jest.fn().mockReturnValue(qb);
        qb.getMany = jest.fn().mockResolvedValue([{ id: message.id }]);
        qb.getCount = jest.fn().mockImplementation(async () => unreadAfterCursor);
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

    const service = new ChatsService(
      { find: jest.fn(), createQueryBuilder: jest.fn() } as never,
      memberRepo as never,
      messageRepo as never,
      { find: jest.fn(), exists: jest.fn(), save: jest.fn(), delete: jest.fn() } as never,
      receiptRepo as never,
      { upsert: jest.fn(), findOneOrFail: jest.fn() } as never,
      {
        assertCanRead: jest.fn().mockResolvedValue({ id: chatId, kind: ChatKind.Direct }),
        isAdmin: jest.fn().mockReturnValue(false),
      } as never,
      { addMember: jest.fn(async () => readerMember), ensureForUser: jest.fn() } as never,
      { countOnline: jest.fn().mockReturnValue(0) } as never,
      { emitToUser: jest.fn() } as never,
    );

    jest.spyOn(service, 'unreadSummary').mockResolvedValue({ total: 0, byChat: {} });

    const before = await service.unreadCount({ sub: readerId, email: 'b@test', role: 'student' }, chatId);
    expect(before).toBe(1);

    const marked = await service.markRead(
      { sub: readerId, email: 'b@test', role: 'teacher' },
      chatId,
      null,
    );
    expect(memberRepo.update).toHaveBeenCalled();
    expect(marked.unreadCount).toBe(0);
    expect(readerMember.lastReadMessageId).toBe(message.id);

    const after = await service.unreadCount({ sub: readerId, email: 'b@test', role: 'tutor' }, chatId);
    expect(after).toBe(0);
  });
});
