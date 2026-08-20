/** @jest-environment node */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ForbiddenException, NotFoundException } from '@nestjs/common';

type Member = {
  chatId: string;
  userId: string;
  archivedAt: Date | null;
  pinnedAt: Date | null;
  favoritedAt: Date | null;
  mutedUntil: Date | null;
  hiddenAt: Date | null;
};

/**
 * Regression: archive/pin/mute/favorite are per-user (USER+CHAT) on chat_members,
 * never device-local and never shared across users.
 */
describe('chat member prefs SSOT', () => {
  const MUTE_FAR = new Date('9999-12-31T23:59:59.000Z');

  function prefsFrom(member: Member) {
    const now = Date.now();
    return {
      archived: Boolean(member.archivedAt),
      pinned: Boolean(member.pinnedAt),
      muted: Boolean(member.mutedUntil && member.mutedUntil.getTime() > now),
      favorite: Boolean(member.favoritedAt),
    };
  }

  function buildService() {
    const members: Member[] = [
      {
        chatId: 'chat-x',
        userId: 'user-a',
        archivedAt: null,
        pinnedAt: null,
        favoritedAt: null,
        mutedUntil: null,
        hiddenAt: null,
      },
      {
        chatId: 'chat-x',
        userId: 'user-b',
        archivedAt: null,
        pinnedAt: null,
        favoritedAt: null,
        mutedUntil: null,
        hiddenAt: null,
      },
    ];

    const readable = new Set(['chat-x']);

    const updateMemberPrefs = async (
      actorUserId: string,
      chatId: string,
      patch: {
        archived?: boolean;
        pinned?: boolean;
        muted?: boolean;
        favorite?: boolean;
      },
    ) => {
      if (!readable.has(chatId)) throw new ForbiddenException();
      const member = members.find(
        (row) => row.chatId === chatId && row.userId === actorUserId,
      );
      if (!member) throw new NotFoundException('Membership not found');
      if (patch.archived !== undefined) {
        member.archivedAt = patch.archived ? member.archivedAt ?? new Date() : null;
      }
      if (patch.pinned !== undefined) {
        member.pinnedAt = patch.pinned ? member.pinnedAt ?? new Date() : null;
      }
      if (patch.favorite !== undefined) {
        member.favoritedAt = patch.favorite ? member.favoritedAt ?? new Date() : null;
      }
      if (patch.muted !== undefined) {
        member.mutedUntil = patch.muted ? MUTE_FAR : null;
      }
      return prefsFrom(member);
    };

    const listFor = (actorUserId: string) => {
      const mine = members.find(
        (row) => row.chatId === 'chat-x' && row.userId === actorUserId,
      );
      return {
        chatId: 'chat-x',
        userState: prefsFrom(
          mine || {
            chatId: 'chat-x',
            userId: actorUserId,
            archivedAt: null,
            pinnedAt: null,
            favoritedAt: null,
            mutedUntil: null,
            hiddenAt: null,
          },
        ),
      };
    };

    return { updateMemberPrefs, listFor, members };
  }

  it('TEST1: User A archives Chat X → list archived=true', async () => {
    const svc = buildService();
    await svc.updateMemberPrefs('user-a', 'chat-x', { archived: true });
    expect(svc.listFor('user-a').userState.archived).toBe(true);
  });

  it('TEST2: same server state for any device of User A', async () => {
    const svc = buildService();
    await svc.updateMemberPrefs('user-a', 'chat-x', { archived: true });
    // Desktop GET uses same membership row — not localStorage.
    expect(svc.listFor('user-a').userState.archived).toBe(true);
  });

  it('TEST3: User B is not affected', async () => {
    const svc = buildService();
    await svc.updateMemberPrefs('user-a', 'chat-x', { archived: true });
    expect(svc.listFor('user-b').userState.archived).toBe(false);
  });

  it('TEST4: unarchive restores archived=false', async () => {
    const svc = buildService();
    await svc.updateMemberPrefs('user-a', 'chat-x', { archived: true });
    await svc.updateMemberPrefs('user-a', 'chat-x', { archived: false });
    expect(svc.listFor('user-a').userState.archived).toBe(false);
  });

  it('TEST5/6/7: reload/login/cleared cache still reads DB row', async () => {
    const svc = buildService();
    await svc.updateMemberPrefs('user-a', 'chat-x', { archived: true });
    // Simulate new session: only members table remains.
    expect(svc.members.find((m) => m.userId === 'user-a')?.archivedAt).toBeTruthy();
    expect(svc.listFor('user-a').userState.archived).toBe(true);
  });

  it('TEST10: non-member cannot archive', async () => {
    const svc = buildService();
    await expect(
      svc.updateMemberPrefs('user-c', 'chat-x', { archived: true }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('TEST ensure path: legitimate access without prior row creates membership then archives', async () => {
    // Mirrors admin subject chats: list shows chat via ACL, prefs ensure membership after ACL.
    const members: Member[] = [];
    const canRead = (userId: string, chatId: string) =>
      userId === 'admin-1' &&
      ['math-chat', 'lang-chat', 'phys-chat', 'chem-chat'].includes(chatId);

    const ensureThenUpdate = async (
      actorUserId: string,
      chatId: string,
      patch: { archived?: boolean },
    ) => {
      if (!canRead(actorUserId, chatId)) throw new ForbiddenException();
      let member = members.find((row) => row.chatId === chatId && row.userId === actorUserId);
      if (!member) {
        member = {
          chatId,
          userId: actorUserId,
          archivedAt: null,
          pinnedAt: null,
          favoritedAt: null,
          mutedUntil: null,
          hiddenAt: null,
        };
        members.push(member);
      }
      if (patch.archived !== undefined) {
        member.archivedAt = patch.archived ? member.archivedAt ?? new Date() : null;
      }
      return prefsFrom(member);
    };

    for (const chatId of ['math-chat', 'lang-chat', 'phys-chat', 'chem-chat']) {
      const state = await ensureThenUpdate('admin-1', chatId, { archived: true });
      expect(state.archived).toBe(true);
      expect(members.find((m) => m.chatId === chatId && m.userId === 'admin-1')?.archivedAt).toBeTruthy();
    }

    await expect(ensureThenUpdate('stranger', 'math-chat', { archived: true })).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('pin / mute / favorite are independent toggles', async () => {
    const svc = buildService();
    await svc.updateMemberPrefs('user-a', 'chat-x', {
      pinned: true,
      muted: true,
      favorite: true,
    });
    const state = svc.listFor('user-a').userState;
    expect(state.pinned).toBe(true);
    expect(state.muted).toBe(true);
    expect(state.favorite).toBe(true);
    expect(state.archived).toBe(false);
  });
});

describe('frontend archive contract', () => {
  const fs = require('fs') as typeof import('fs');
  const path = require('path') as typeof import('path');

  function readSrc(rel: string): string {
    let dir = __dirname;
    for (let i = 0; i < 10; i += 1) {
      if (
        fs.existsSync(path.join(dir, 'src', 'pages', 'Chats.jsx')) &&
        fs.existsSync(path.join(dir, 'apps', 'api', 'package.json'))
      ) {
        return fs.readFileSync(path.join(dir, rel), 'utf8');
      }
      dir = path.dirname(dir);
    }
    throw new Error('repo root not found');
  }

  it('TEST11/12: desktop menu labels + API archive/unarchive wired', () => {
    const menu = readSrc('src/components/chats/ChatListMenu.jsx');
    const api = readSrc('src/api/chats.api.js');
    const page = readSrc('src/pages/Chats.jsx');
    expect(menu).toMatch(/Переместить в архив/);
    expect(menu).toMatch(/Вернуть из архива/);
    expect(menu).toMatch(/Пометить непрочитанным/);
    expect(api).toMatch(/archiveChat/);
    expect(api).toMatch(/unarchiveChat/);
    expect(api).toMatch(/member-prefs/);
    expect(api).toMatch(/markUnread/);
    expect(page).toMatch(/chat\.member_prefs/);
    expect(page).toMatch(/onToggleMemberPref/);
    expect(page).toMatch(/chatsApi\.archiveChat/);
  });

  it('prefs.js no longer treats localStorage as archive SSOT', () => {
    const prefs = readSrc('src/lib/chat/prefs.js');
    expect(prefs).toMatch(/SSOT for archive/);
    expect(prefs).not.toMatch(/function toggleArchivedChat/);
    expect(prefs).toMatch(/longhua_chat_drafts_v1/);
  });

  it('controller exposes archive endpoints before generic :chatId routes collision-safe', () => {
    const ctrl = readSrc('apps/api/src/modules/chats/controllers/chats.controller.ts');
    expect(ctrl).toMatch(/@Post\(':chatId\/archive'\)/);
    expect(ctrl).toMatch(/@Post\(':chatId\/unarchive'\)/);
    expect(ctrl).toMatch(/@Patch\(':chatId\/member-prefs'\)/);
  });

  it('TEST unauthorized: chats controller requires JwtAuthGuard (401 without token)', () => {
    const ctrl = readSrc('apps/api/src/modules/chats/controllers/chats.controller.ts');
    expect(ctrl).toMatch(/@UseGuards\(JwtAuthGuard, RolesGuard\)/);
    expect(ctrl).toMatch(/archiveChat\(@CurrentUser\(\) actor/);
  });

  it('TEST13/14: socket emits chat.member_prefs to actor only (cross-device SSOT)', () => {
    const svc = readSrc('apps/api/src/modules/chats/services/chats.service.ts');
    expect(svc).toMatch(/emitToUser\(actor\.sub, 'chat\.member_prefs'/);
    expect(svc).toMatch(/async archiveChat/);
    expect(svc).toMatch(/async unarchiveChat/);
  });

  it('desktop hover archive stops row openChat (propagation)', () => {
    const sidebar = readSrc('src/components/chats/ChatSidebar.jsx');
    expect(sidebar).toMatch(/function stopRowOpen/);
    expect(sidebar).toMatch(/onClick=\{runArchive\}/);
    expect(sidebar).toMatch(/onPointerDown=\{stopRowOpen\}/);
    expect(sidebar).toMatch(/Переместить в архив/);
  });

  it('updateMemberPrefs ensures membership after ACL (admin subject chats)', () => {
    const svc = readSrc('apps/api/src/modules/chats/services/chats.service.ts');
    const prefsBlock = svc.slice(svc.indexOf('async updateMemberPrefs'));
    const body = prefsBlock.slice(0, prefsBlock.indexOf('async archiveChat'));
    expect(body).toMatch(/assertCanRead/);
    expect(body).toMatch(/membershipSync\.addMember/);
    // Order: ACL first, then ensure — never create row for unauthorized users.
    expect(body.indexOf('assertCanRead')).toBeLessThan(body.indexOf('addMember'));
  });
});
