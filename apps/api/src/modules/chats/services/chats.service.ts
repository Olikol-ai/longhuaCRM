import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, MoreThan, Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  ChatEntity,
  ChatMemberEntity,
  ChatMessageEntity,
  ChatPinnedMessageEntity,
  UserChatProfileEntity,
} from '../entities';
import { ChatKind, ChatMemberRole } from '../enums/chat.enums';
import { ChatMembershipSyncService } from './chat-membership-sync.service';

export type ChatListItem = ChatEntity & { unreadCount: number };

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
    @InjectRepository(UserChatProfileEntity)
    private readonly profileRepo: Repository<UserChatProfileEntity>,
    private readonly access: ChatAccessService,
    private readonly membershipSync: ChatMembershipSyncService,
  ) {}

  async listChats(actor: DomainAccessActor): Promise<ChatListResponse> {
    await this.membershipSync.ensureForUser(actor.sub);
    const memberships = await this.memberRepo.find({
      where: { userId: actor.sub },
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
      const unreadCount = await this.countUnread(chat.id, membership);
      items.push(Object.assign(chat, { unreadCount }));
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

  async getChat(actor: DomainAccessActor, chatId: string): Promise<ChatEntity> {
    return this.access.assertCanRead(actor, chatId);
  }

  async unreadCount(actor: DomainAccessActor, chatId: string): Promise<number> {
    await this.access.assertCanRead(actor, chatId);
    const member = await this.memberRepo.findOne({
      where: { chatId, userId: actor.sub },
      relations: { lastReadMessage: true },
    });
    return this.countUnread(chatId, member);
  }

  async markRead(actor: DomainAccessActor, chatId: string, messageId: string): Promise<void> {
    await this.access.assertCanRead(actor, chatId);
    const message = await this.messageRepo.findOne({
      where: { id: messageId, chatId, deletedAt: IsNull() },
    });
    if (!message) throw new NotFoundException('Message not found');
    await this.memberRepo.update({ chatId, userId: actor.sub }, { lastReadMessageId: messageId });
  }

  async createGroup(
    actor: DomainAccessActor,
    title: string,
    memberUserIds: string[],
    description?: string,
  ): Promise<ChatEntity> {
    return this.membershipSync.createGroup(title, actor.sub, memberUserIds, description ?? null);
  }

  async createDirect(actor: DomainAccessActor, userId: string): Promise<ChatEntity> {
    await this.access.assertCanStartDirect(actor, userId);
    return this.membershipSync.findOrCreateDirect(actor.sub, userId);
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
    await Promise.all(memberUserIds.map((userId) => this.membershipSync.addMember(chatId, userId)));
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

  private async countUnread(
    chatId: string,
    member: ChatMemberEntity | null | undefined,
  ): Promise<number> {
    const createdAfter = member?.lastReadMessage?.createdAt;
    return this.messageRepo.count({
      where: {
        chatId,
        deletedAt: IsNull(),
        ...(createdAfter ? { createdAt: MoreThan(createdAfter) } : {}),
      },
    });
  }
}
