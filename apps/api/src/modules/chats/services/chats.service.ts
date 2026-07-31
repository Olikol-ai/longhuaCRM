import { ForbiddenException, GoneException, Injectable, Logger, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  ChatEntity,
  ChatMemberEntity,
  ChatMessageEntity,
  ChatPinnedMessageEntity,
  ChatReadReceiptEntity,
  UserChatProfileEntity,
} from '../entities';
import { ChatKind, ChatMemberRole } from '../enums/chat.enums';
import { ChatGateway } from '../gateway/chat.gateway';
import { ChatMembershipSyncService } from './chat-membership-sync.service';
import { ChatPresenceService } from './chat-presence.service';

export type ChatListItem = ChatEntity & {
  unreadCount: number;
  memberCount: number;
  onlineCount: number;
  /** Member user ids — used by FE to recompute onlineCount on presence events. */
  memberUserIds: string[];
};

export type ChatListResponse = {
  groups: Record<string, ChatListItem[]>;
  totalUnread: number;
};

@Injectable()
export class ChatsService {
  private readonly logger = new Logger(ChatsService.name);

  constructor(
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(ChatMessageEntity) private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatPinnedMessageEntity)
    private readonly pinnedRepo: Repository<ChatPinnedMessageEntity>,
    @InjectRepository(ChatReadReceiptEntity)
    private readonly receiptRepo: Repository<ChatReadReceiptEntity>,
    @InjectRepository(UserChatProfileEntity)
    private readonly profileRepo: Repository<UserChatProfileEntity>,
    private readonly access: ChatAccessService,
    private readonly membershipSync: ChatMembershipSyncService,
    private readonly presence: ChatPresenceService,
    @Optional() private readonly gateway?: ChatGateway,
  ) {}

  async listChats(actor: DomainAccessActor): Promise<ChatListResponse> {
    await this.membershipSync.ensureForUser(actor.sub);
    const memberships = await this.memberRepo.find({
      where: { userId: actor.sub, hiddenAt: IsNull() },
      relations: { chat: { subject: true } },
    });
    const membershipChats = memberships
      .map((row) => row.chat)
      .filter((chat): chat is ChatEntity => Boolean(chat));
    // Admins see all non-Direct chats; Direct stays membership-only (E2EE privacy).
    let chats: ChatEntity[];
    if (this.access.isAdmin(actor)) {
      const nonDirect = await this.chatRepo
        .createQueryBuilder('chat')
        .leftJoinAndSelect('chat.subject', 'subject')
        .where('chat.kind <> :direct', { direct: ChatKind.Direct })
        .orderBy('chat.updated_at', 'DESC')
        .getMany();
      const myDirect = membershipChats.filter((chat) => chat.kind === ChatKind.Direct);
      chats = [...nonDirect, ...myDirect];
    } else {
      chats = membershipChats;
    }

    const membershipByChat = new Map(memberships.map((row) => [row.chatId, row]));
    const seen = new Set<string>();
    const items: ChatListItem[] = [];
    for (const chat of chats) {
      if (seen.has(chat.id)) continue;
      seen.add(chat.id);
      const membership = membershipByChat.get(chat.id);
      if (!this.access.isAdmin(actor) && membership?.hiddenAt) continue;
      if (chat.kind === ChatKind.Direct && !membership) continue;
      const unreadCount = await this.countUnread(chat.id, membership, actor.sub);
      const counts = await this.memberOnlineCounts(chat.id);
      items.push(Object.assign(chat, { unreadCount, ...counts }));
    }

    const groups = items.reduce<Record<string, ChatListItem[]>>((acc, chat) => {
      (acc[chat.kind] ??= []).push(chat);
      return acc;
    }, {});

    const totalUnread = items.reduce((sum, chat) => sum + chat.unreadCount, 0);
    return { groups, totalUnread };
  }

  async unreadSummary(actor: DomainAccessActor): Promise<{ total: number; byChat: Record<string, number> }> {
    // Lean path for the nav badge + WS fan-out.
    // Do NOT call listChats(): that runs membership sync, online counts, and
    // sequential per-chat work — and Layout used to stampede this endpoint.
    const memberships = await this.memberRepo.find({
      where: { userId: actor.sub, hiddenAt: IsNull() },
    });

    const counted = await Promise.all(
      memberships.map(async (membership) => ({
        chatId: membership.chatId,
        unreadCount: await this.countUnread(membership.chatId, membership, actor.sub),
      })),
    );

    const byChat: Record<string, number> = {};
    let total = 0;
    for (const row of counted) {
      if (row.unreadCount > 0) {
        byChat[row.chatId] = row.unreadCount;
        total += row.unreadCount;
      }
    }
    return { total, byChat };
  }

  async getChat(actor: DomainAccessActor, chatId: string): Promise<
    ChatEntity & { memberCount: number; onlineCount: number; memberUserIds: string[] }
  > {
    const chat = await this.access.assertCanRead(actor, chatId);
    const counts = await this.memberOnlineCounts(chatId);
    return Object.assign(chat, counts);
  }

  async unreadCount(actor: DomainAccessActor, chatId: string): Promise<number> {
    await this.access.assertCanRead(actor, chatId);
    const member = await this.memberRepo.findOne({
      where: { chatId, userId: actor.sub },
    });
    return this.countUnread(chatId, member, actor.sub);
  }

  /**
   * Persist read cursor for the actor in this chat.
   * When messageId is omitted, advances to the latest non-deleted message.
   * Membership is ensured so system/subject/course chats always store last_read.
   *
   * IMPORTANT: use QueryBuilder/update — never save() an entity that already has
   * lastReadMessage relation loaded; TypeORM keeps the old FK and unread sticks.
   */
  async markRead(
    actor: DomainAccessActor,
    chatId: string,
    messageId?: string | null,
  ): Promise<{ lastReadMessageId: string | null; unreadCount: number }> {
    this.logger.log(
      `markRead start userId=${actor.sub} chatId=${chatId} messageId=${messageId ?? 'latest'}`,
    );
    await this.access.assertCanRead(actor, chatId);
    // Readers (incl. school/subject members) must have a ChatMember row for last_read.
    await this.membershipSync.addMember(chatId, actor.sub);

    let target: ChatMessageEntity | null;
    if (messageId) {
      target = await this.messageRepo.findOne({
        where: { id: messageId, chatId, deletedAt: IsNull() },
      });
      if (!target) throw new NotFoundException('Message not found');
    } else {
      target = await this.messageRepo.findOne({
        where: { chatId, deletedAt: IsNull() },
        order: { createdAt: 'DESC', id: 'DESC' },
      });
    }

    if (!target) {
      const unreadCount = await this.unreadCount(actor, chatId);
      await this.emitUnreadSummary(actor);
      this.logger.log(
        `markRead empty-chat userId=${actor.sub} chatId=${chatId} unread=${unreadCount}`,
      );
      return { lastReadMessageId: null, unreadCount };
    }

    const member = await this.memberRepo.findOne({
      where: { chatId, userId: actor.sub },
    });
    if (!member) {
      throw new NotFoundException('Chat membership not found');
    }

    const currentCursor = await this.resolveReadCursor(chatId, member);

    // Never move the cursor backwards (e.g. stale client / race with newer WS reads).
    if (!this.isMessageAfterOrEqual(target, currentCursor)) {
      const unreadCount = await this.countUnread(chatId, member, actor.sub);
      await this.emitUnreadSummary(actor);
      this.logger.log(
        `markRead no-backwards userId=${actor.sub} chatId=${chatId} ` +
          `keepLastRead=${member.lastReadMessageId} target=${target.id} unread=${unreadCount}`,
      );
      return { lastReadMessageId: member.lastReadMessageId, unreadCount };
    }

    // Atomic FK update — avoids TypeORM relation save retaining the old cursor.
    await this.memberRepo.update(
      { chatId, userId: actor.sub },
      {
        lastReadMessageId: target.id,
        lastReadAt: target.createdAt,
        hiddenAt: null,
      },
    );

    // Compare entirely in Postgres — JS Date loses microsecond precision and would
    // skip the cursor message when inserting receipts (created_at .722391 > Date .722).
    const toMark = await this.messageRepo
      .createQueryBuilder('message')
      .select(['message.id'])
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.deletedAt IS NULL')
      .andWhere(
        `(message.created_at, message.id) <= (
           SELECT cursor.created_at, cursor.id
           FROM chat_messages cursor
           WHERE cursor.id = :targetId
         )`,
        { targetId: target.id },
      )
      .getMany();

    if (toMark.length > 0) {
      await this.receiptRepo
        .createQueryBuilder()
        .insert()
        .into(ChatReadReceiptEntity)
        .values(
          toMark.map((row) => ({
            messageId: row.id,
            userId: actor.sub,
          })),
        )
        .orIgnore()
        .execute();
    }

    const refreshed = await this.memberRepo.findOne({
      where: { chatId, userId: actor.sub },
    });
    const unreadCount = await this.countUnread(chatId, refreshed, actor.sub);
    await this.emitUnreadSummary(actor);
    this.logger.log(
      `markRead done userId=${actor.sub} chatId=${chatId} ` +
        `lastReadMessageId=${refreshed?.lastReadMessageId ?? target.id} ` +
        `lastReadAt=${refreshed?.lastReadAt?.toISOString?.() ?? 'null'} ` +
        `latestTargetId=${target.id} unread=${unreadCount} receiptsMarked=${toMark.length}`,
    );
    return {
      lastReadMessageId: refreshed?.lastReadMessageId ?? target.id,
      unreadCount,
    };
  }

  /** Advance read cursor when the actor sends a message (group/system/subject/course/DM). */
  async advanceLastReadForSender(
    chatId: string,
    userId: string,
    messageId: string,
  ): Promise<void> {
    await this.membershipSync.addMember(chatId, userId);
    const message = await this.messageRepo.findOne({
      where: { id: messageId, chatId },
    });
    await this.memberRepo.update(
      { chatId, userId },
      {
        lastReadMessageId: messageId,
        lastReadAt: message?.createdAt ?? new Date(),
        hiddenAt: null,
      },
    );
  }

  private async emitUnreadSummary(actor: DomainAccessActor): Promise<void> {
    try {
      const summary = await this.unreadSummary(actor);
      this.logger.log(
        `chat.unread emit userId=${actor.sub} total=${summary.total} byChat=${JSON.stringify(summary.byChat)}`,
      );
      this.gateway?.emitToUser(actor.sub, 'chat.unread', summary);
    } catch {
      // ignore badge fan-out failures
    }
  }

  private isMessageAfterOrEqual(
    candidate: Pick<ChatMessageEntity, 'id' | 'createdAt'>,
    current: Pick<ChatMessageEntity, 'id' | 'createdAt'> | null,
  ): boolean {
    if (!current) return true;
    const candidateAt = new Date(candidate.createdAt).getTime();
    const currentAt = new Date(current.createdAt).getTime();
    if (candidateAt > currentAt) return true;
    if (candidateAt < currentAt) return false;
    // Timestamp-only cursor (message deleted): treat equal time as already read.
    if (!current.id) return true;
    return candidate.id >= current.id;
  }

  private async resolveReadCursor(
    chatId: string,
    member: ChatMemberEntity,
  ): Promise<Pick<ChatMessageEntity, 'id' | 'createdAt'> | null> {
    if (member.lastReadMessageId) {
      const byId = await this.messageRepo.findOne({
        where: { id: member.lastReadMessageId, chatId },
      });
      if (byId) return byId;
    }
    if (member.lastReadAt) {
      return { id: '', createdAt: member.lastReadAt };
    }
    return null;
  }

  async createGroup(
    actor: DomainAccessActor,
    title: string,
    memberUserIds: string[],
    description?: string,
  ): Promise<ChatEntity> {
    return this.membershipSync.createGroup(title, actor.sub, memberUserIds, description ?? null);
  }

  async createDirect(_actor: DomainAccessActor, _userId: string): Promise<never> {
    throw new GoneException(
      'Прямое создание личного чата отключено. Отправьте запрос: POST /chats/dm-requests',
    );
  }

  async hideMembership(actor: DomainAccessActor, chatId: string): Promise<void> {
    await this.access.assertCanRead(actor, chatId);
    const member = await this.memberRepo.findOne({ where: { chatId, userId: actor.sub } });
    if (!member) throw new NotFoundException('Membership not found');
    member.hiddenAt = new Date();
    await this.memberRepo.save(member);
    this.gateway?.emitToUser(actor.sub, 'chat.deleted', { chatId, personal: true });
  }

  async inviteMembers(
    actor: DomainAccessActor,
    chatId: string,
    memberUserIds: string[],
  ): Promise<ChatMemberEntity[]> {
    const chat = await this.access.assertCanWrite(actor, chatId);
    if (chat.kind !== ChatKind.Group && !this.access.isAdmin(actor)) {
      throw new ForbiddenException('Only group chats accept invitations');
    }
    const member = await this.memberRepo.findOne({ where: { chatId, userId: actor.sub } });
    if (
      !this.access.isAdmin(actor) &&
      member?.role !== ChatMemberRole.Owner &&
      member?.role !== ChatMemberRole.Admin
    ) {
      throw new ForbiddenException('Only chat owners/admins can invite members');
    }
    for (const userId of memberUserIds) {
      await this.access.assertCanInviteMember(actor, chatId, userId);
      await this.membershipSync.addMember(chatId, userId);
    }
    return this.listMembers(actor, chatId);
  }

  async pin(actor: DomainAccessActor, chatId: string, messageId: string): Promise<void> {
    await this.access.assertCanWrite(actor, chatId);
    const message = await this.messageRepo.exists({
      where: { id: messageId, chatId, deletedAt: IsNull() },
    });
    if (!message) throw new NotFoundException('Message not found');
    if (!(await this.pinnedRepo.exists({ where: { chatId, messageId } }))) {
      await this.pinnedRepo.save({ chatId, messageId, pinnedByUserId: actor.sub });
    }
  }

  async unpin(actor: DomainAccessActor, chatId: string, messageId: string): Promise<void> {
    await this.access.assertCanWrite(actor, chatId);
    await this.pinnedRepo.delete({ chatId, messageId });
  }

  async listPins(actor: DomainAccessActor, chatId: string): Promise<ChatPinnedMessageEntity[]> {
    await this.access.assertCanRead(actor, chatId);
    return this.pinnedRepo.find({
      where: { chatId },
      relations: { message: true },
      order: { pinnedAt: 'DESC' },
    });
  }

  async listMembers(actor: DomainAccessActor, chatId: string): Promise<ChatMemberEntity[]> {
    await this.access.assertCanRead(actor, chatId);
    return this.memberRepo.find({ where: { chatId }, relations: { user: true } });
  }

  async updateProfile(
    actor: DomainAccessActor,
    profile: Partial<
      Pick<UserChatProfileEntity, 'nativeLanguage' | 'spokenLanguage' | 'timezone' | 'levelLabel'>
    >,
  ): Promise<UserChatProfileEntity> {
    await this.profileRepo.upsert({ userId: actor.sub, ...profile }, ['userId']);
    return this.profileRepo.findOneOrFail({ where: { userId: actor.sub } });
  }

  private async memberOnlineCounts(
    chatId: string,
  ): Promise<{ memberCount: number; onlineCount: number; memberUserIds: string[] }> {
    const members = await this.memberRepo.find({ where: { chatId } });
    const memberUserIds = members.map((m) => m.userId);
    return {
      memberCount: memberUserIds.length,
      onlineCount: this.presence.countOnline(memberUserIds),
      memberUserIds,
    };
  }

  private async countUnread(
    chatId: string,
    member: ChatMemberEntity | null | undefined,
    viewerUserId?: string,
  ): Promise<number> {
    if (!member) return 0;

    const query = this.messageRepo
      .createQueryBuilder('message')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.deletedAt IS NULL');

    if (viewerUserId) {
      // Own messages never increment unread; system messages (null sender) do until read.
      query.andWhere(
        '(message.senderUserId IS NULL OR message.senderUserId <> :viewerUserId)',
        { viewerUserId },
      );
    }

    /**
     * Source of truth: ChatMember.last_read_message_id (not ReadReceipt).
     *
     * CRITICAL: never pass JS Date into Postgres created_at comparisons.
     * node-pg truncates timestamptz to milliseconds, so a cursor message with
     * created_at=….722391 is counted as unread against Date(….722).
     * Keep the row comparison entirely inside PostgreSQL.
     */
    if (member.lastReadMessageId) {
      query.andWhere(
        `(message.created_at, message.id) > (
           SELECT cursor.created_at, cursor.id
           FROM chat_messages cursor
           WHERE cursor.id = :readId AND cursor.chat_id = :chatId
         )`,
        { readId: member.lastReadMessageId, chatId },
      );
    } else if (member.lastReadAt) {
      // Fallback when FK was cleared (message deleted): compare against stored column.
      query.andWhere(
        `message.created_at > (
           SELECT cm.last_read_at FROM chat_members cm
           WHERE cm.chat_id = :chatId AND cm.user_id = :memberUserId
         )`,
        { chatId, memberUserId: member.userId },
      );
    }

    const unread = await query.getCount();
    this.logger.debug(
      `countUnread userId=${viewerUserId ?? member.userId} chatId=${chatId} ` +
        `lastReadMessageId=${member.lastReadMessageId} ` +
        `lastReadAt=${member.lastReadAt ? new Date(member.lastReadAt).toISOString() : 'null'} ` +
        `unread=${unread}`,
    );

    return unread;
  }
}
