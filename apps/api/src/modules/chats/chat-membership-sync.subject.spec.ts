import { ChatKind } from './enums/chat.enums';
import { ChatMembershipSyncService } from './services/chat-membership-sync.service';

describe('ChatMembershipSyncService.syncSubjectChatsForUser', () => {
  it('ensures desired subject chats and removes entitlements that ended', async () => {
    const mathId = 'subj-math';
    const chineseId = 'subj-chinese';
    const mathChat = {
      id: 'chat-math',
      kind: ChatKind.Subject,
      subjectId: mathId,
      title: '📚 Математика',
    };
    const chineseChat = {
      id: 'chat-chinese',
      kind: ChatKind.Subject,
      subjectId: chineseId,
      title: '📚 Китайский язык',
    };

    const savedMembers: Array<{ chatId: string; userId: string }> = [];
    const deleted: Array<{ chatId: string; userId: string }> = [];
    const ensureSubjectChatMembership = jest.fn(
      async (_userId: string, subjectId: string) => {
        const chat = subjectId === mathId ? mathChat : chineseChat;
        savedMembers.push({ chatId: chat.id, userId: 'u1' });
        return chat;
      },
    );

    const service = Object.create(
      ChatMembershipSyncService.prototype,
    ) as ChatMembershipSyncService;
    Object.assign(service, {
      resolveDerivedSubjectIds: jest.fn(async () => new Set([mathId])),
      userSubjectRepo: {
        find: jest.fn(async () => [
          { id: 'us1', userId: 'u1', subjectId: chineseId, source: 'derived' },
        ]),
        save: jest.fn(async (row: unknown) => row),
        delete: jest.fn(async () => undefined),
      },
      ensureSubjectChatMembership,
      chatRepo: {
        find: jest.fn(async () => [mathChat, chineseChat]),
      },
      memberRepo: {
        delete: jest.fn(async (where: { chatId: string; userId: string }) => {
          deleted.push(where);
        }),
      },
    });

    const desired = await service.syncSubjectChatsForUser('u1');
    expect(desired).toEqual([mathId]);
    expect(ensureSubjectChatMembership).toHaveBeenCalledTimes(1);
    expect(ensureSubjectChatMembership).toHaveBeenCalledWith('u1', mathId);
    expect(deleted).toEqual([{ chatId: chineseChat.id, userId: 'u1' }]);
    expect(savedMembers).toEqual([{ chatId: mathChat.id, userId: 'u1' }]);
  });
});
