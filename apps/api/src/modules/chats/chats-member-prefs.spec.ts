import { ForbiddenException } from '@nestjs/common';
import { ChatKind } from './enums/chat.enums';
import { ChatsService } from './services/chats.service';

/**
 * Admin listChats shows subject chats without chat_members.
 * Prefs must ensure membership AFTER assertCanRead (same as markRead).
 * Archive writes archived_at atomically via SQL (survives reload / ensureForUser).
 */
describe('ChatsService.updateMemberPrefs / archive', () => {
  function build(opts?: { assertCanReadFails?: boolean }) {
    const member = {
      chatId: 'math-chat',
      userId: 'admin-1',
      archivedAt: null as Date | null,
      pinnedAt: null as Date | null,
      favoritedAt: null as Date | null,
      mutedUntil: null as Date | null,
      hiddenAt: null as Date | null,
      lastReadMessageId: null as string | null,
      lastReadAt: null as Date | null,
    };

    const memberRepo = {
      findOne: jest.fn(async () => ({ ...member })),
      save: jest.fn(async (row: typeof member) => {
        Object.assign(member, row);
        return row;
      }),
      find: jest.fn(),
      update: jest.fn(),
      query: jest.fn(async (sql: string, params: unknown[] = []) => {
        if (String(sql).includes('archived_at = COALESCE')) {
          member.archivedAt = member.archivedAt ?? new Date();
        }
        if (String(sql).includes('archived_at = NULL')) {
          member.archivedAt = null;
        }
        if (String(sql).includes('pinned_at = COALESCE')) {
          member.pinnedAt = member.pinnedAt ?? new Date();
        }
        if (String(sql).includes('pinned_at = NULL')) {
          member.pinnedAt = null;
        }
        if (String(sql).includes('favorited_at = COALESCE')) {
          member.favoritedAt = member.favoritedAt ?? new Date();
        }
        if (String(sql).includes('favorited_at = NULL')) {
          member.favoritedAt = null;
        }
        if (String(sql).includes('muted_until = $')) {
          member.mutedUntil = (params[2] as Date) ?? new Date('9999-12-31T23:59:59.000Z');
        }
        if (String(sql).includes('muted_until = NULL')) {
          member.mutedUntil = null;
        }
        return [];
      }),
    };

    const membershipSync = {
      addMember: jest.fn(async (chatId: string, userId: string) => {
        member.chatId = chatId;
        member.userId = userId;
        return member;
      }),
      ensureForUser: jest.fn(),
    };

    const access = {
      assertCanRead: opts?.assertCanReadFails
        ? jest.fn().mockRejectedValue(new ForbiddenException('Chat membership is required'))
        : jest.fn().mockResolvedValue({
            id: 'math-chat',
            kind: ChatKind.Subject,
            title: '📚 Математика',
            subjectId: 'subj-math',
          }),
      isAdmin: jest.fn().mockReturnValue(true),
    };

    const gateway = { emitToUser: jest.fn() };

    const service = new ChatsService(
      { find: jest.fn(), createQueryBuilder: jest.fn() } as never,
      memberRepo as never,
      { findOne: jest.fn(), createQueryBuilder: jest.fn() } as never,
      { find: jest.fn(), exists: jest.fn(), save: jest.fn(), delete: jest.fn() } as never,
      { createQueryBuilder: jest.fn() } as never,
      { upsert: jest.fn(), findOneOrFail: jest.fn() } as never,
      access as never,
      membershipSync as never,
      { countOnline: jest.fn().mockReturnValue(0) } as never,
      gateway as never,
    );

    return { service, memberRepo, membershipSync, access, member, gateway };
  }

  const admin = { sub: 'admin-1', email: 'admin@test', role: 'admin' };
  const stranger = { sub: 'stranger', email: 'x@test', role: 'student' };

  it('TEST subject/Math archive: ensures membership then sets archived_at', async () => {
    const { service, membershipSync, memberRepo, member, access, gateway } = build();
    const state = await service.archiveChat(admin, 'math-chat');
    expect(access.assertCanRead).toHaveBeenCalledWith(admin, 'math-chat');
    expect(membershipSync.addMember).toHaveBeenCalledWith('math-chat', 'admin-1');
    expect(memberRepo.query).toHaveBeenCalled();
    expect(member.archivedAt).toBeTruthy();
    expect(state.archived).toBe(true);
    expect(gateway.emitToUser).toHaveBeenCalledWith(
      'admin-1',
      'chat.member_prefs',
      expect.objectContaining({ chatId: 'math-chat' }),
    );
  });

  it('TEST Language/Physics/Chemistry-style subject archive uses same ensure path', async () => {
    const titles = [
      { id: 'lang-chat', title: '📚 Язык' },
      { id: 'phys-chat', title: '📚 Физика' },
      { id: 'chem-chat', title: '📚 Химия' },
    ];
    for (const row of titles) {
      const { service, membershipSync, access } = build();
      access.assertCanRead.mockResolvedValue({
        id: row.id,
        kind: ChatKind.Subject,
        title: row.title,
      });
      const state = await service.archiveChat(admin, row.id);
      expect(membershipSync.addMember).toHaveBeenCalledWith(row.id, 'admin-1');
      expect(state.archived).toBe(true);
    }
  });

  it('TEST unarchive clears archived_at', async () => {
    const { service, member } = build();
    member.archivedAt = new Date();
    const state = await service.unarchiveChat(admin, 'math-chat');
    expect(member.archivedAt).toBeNull();
    expect(state.archived).toBe(false);
  });

  it('TEST archive twice is idempotent (COALESCE keeps first timestamp)', async () => {
    const { service, member } = build();
    const first = await service.archiveChat(admin, 'math-chat');
    const ts = member.archivedAt;
    const second = await service.archiveChat(admin, 'math-chat');
    expect(first.archived).toBe(true);
    expect(second.archived).toBe(true);
    expect(member.archivedAt).toBe(ts);
  });

  it('TEST pin/mute/favorite share ensure-membership path', async () => {
    const { service, membershipSync, member } = build();
    await service.updateMemberPrefs(admin, 'math-chat', {
      pinned: true,
      muted: true,
      favorite: true,
    });
    expect(membershipSync.addMember).toHaveBeenCalledWith('math-chat', 'admin-1');
    expect(member.pinnedAt).toBeTruthy();
    expect(member.favoritedAt).toBeTruthy();
    expect(member.mutedUntil).toBeTruthy();
  });

  it('TEST no access → Forbidden before addMember (no privilege escalation)', async () => {
    const { service, membershipSync, access } = build({ assertCanReadFails: true });
    await expect(service.archiveChat(stranger, 'math-chat')).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(access.assertCanRead).toHaveBeenCalled();
    expect(membershipSync.addMember).not.toHaveBeenCalled();
  });

  it('TEST DM with existing membership still archives', async () => {
    const { service, membershipSync, access, member } = build();
    access.assertCanRead.mockResolvedValue({ id: 'dm-1', kind: ChatKind.Direct });
    access.isAdmin.mockReturnValue(false);
    member.chatId = 'dm-1';
    member.userId = 'admin-1';
    const state = await service.archiveChat(admin, 'dm-1');
    expect(membershipSync.addMember).toHaveBeenCalledWith('dm-1', 'admin-1');
    expect(state.archived).toBe(true);
  });
});
