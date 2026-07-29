import { ForbiddenException, GoneException, Injectable, NotFoundException, Optional } from '@nestjs/common';
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
};

export type ChatListResponse = {
  groups: Record<string, ChatListItem[]>;
  totalUnread: number;
};

@Injectable()
export class ChatsService {
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
      relations: { chat: true, lastReadMessage: true },
    });
    const chats = this.access.isAdmin(actor)
      ? await this.chatRepo.find({ order: { updatedAt: 'DESC' } })
      : memberships
          .map((row) => row.chat)
          .filter((chat): chat is ChatEntity => Boolean(chat));

    const membershipByChat = new Map(memberships.map((row) => [row.chatId, row]));
    const items: ChatListItem[] = [];
    for (const chat of chats) {
      const membership = membershipByChat.get(chat.id);
      if (!this.access.isAdmin(actor) && membership?.hiddenAt) continue;
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
    const listed = await this.listChats(actor);
    const byChat: Record<string, number> = {};
    for (const rows of Object.values(listed.groups)) {
      for (const chat of rows) {
        if (chat.unreadCount > 0) byChat[chat.id] = chat.unreadCount;
      }
    }
    return { total: listed.totalUnread, byChat };
  }

  async getChat(actor: DomainAccessActor, chatId: string): Promise<ChatEntity & { memberCount: number; onlineCount: number }> {
    const chat = await this.access.assertCanRead(actor, chatId);
    const counts = await this.memberOnlineCounts(chatId);
    return Object.assign(chat, counts);
  }

  async unreadCount(actor: DomainAccessActor, chatId: string): Promise<number> {
    await this.access.assertCanRead(actor, chatId);
    const member = await this.memberRepo.findOne({
      where: { chatId, userId: actor.sub },
      relations: { lastReadMessage: true },
    });
    return this.countUnread(chatId, member, actor.sub);
  }

  async markRead(actor: DomainAccessActor, chatId: string, messageId: string): Promise<void> {
    await this.access.assertCanRead(actor, chatId);
    const message = await this.messageRepo.findOne({
      where: { id: messageId, chatId, deletedAt: IsNull() },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.memberRepo.update({ chatId, userId: actor.sub }, { lastReadMessageId: messageId });

    const toMark = await this.messageRepo
      .createQueryBuilder('message')
      .select(['message.id'])
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.deletedAt IS NULL')
      .andWhere('message.createdAt <= :createdAt', { createdAt: message.createdAt })
      .getMany();

    if (toMark.length === 0) return;

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
  ): Promise<{ memberCount: number; onlineCount: number }> {
    const members = await this.memberRepo.find({ where: { chatId } });
    const userIds = members.map((m) => m.userId);
    return {
      memberCount: userIds.length,
      onlineCount: this.presence.countOnline(userIds),
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
      query.andWhere(
        '(message.senderUserId IS NULL OR message.senderUserId <> :viewerUserId)',
        { viewerUserId },
      );
    }

    let lastRead = member.lastReadMessage ?? null;
    if (!lastRead && member.lastReadMessageId) {
      lastRead = await this.messageRepo.findOne({
        where: { id: member.lastReadMessageId, chatId },
      });
    }

    if (lastRead) {
      query.andWhere(
        '(message.createdAt > :readAt OR (message.createdAt = :readAt AND message.id > :readId))',
        { readAt: lastRead.createdAt, readId: lastRead.id },
      );
    }

    return query.getCount();
  }
}
