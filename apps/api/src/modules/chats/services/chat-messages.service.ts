import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { NotificationsService } from '../../notifications/notifications.service';
import { ChatMemberEntity, ChatMessageEntity } from '../entities';
import { ChatMessageType } from '../enums/chat.enums';
import { ChatGateway } from '../gateway/chat.gateway';
import { ChatPresenceService } from './chat-presence.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class ChatMessagesService {
  private readonly logger = new Logger(ChatMessagesService.name);

  constructor(
    @InjectRepository(ChatMessageEntity) private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    private readonly access: ChatAccessService,
    private readonly presence: ChatPresenceService,
    private readonly notifications: NotificationsService,
    @Optional() private readonly gateway?: ChatGateway,
  ) {}

  /**
   * Loads chat history from PostgreSQL (source of truth).
   * Returns newest-first page; frontend reverses to chronological order.
   * Cursor `before`: message UUID (preferred) or ISO date (legacy).
   */
  async list(
    actor: DomainAccessActor,
    chatId: string,
    limit = 50,
    before?: string,
  ): Promise<ChatMessageEntity[]> {
    await this.access.assertCanRead(actor, chatId);
    const take = Math.min(Math.max(limit ?? 50, 1), 100);

    const query = this.messageRepo
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('message.senderUser', 'sender')
      .where('message.chatId = :chatId', { chatId })
      .andWhere('message.deletedAt IS NULL')
      .orderBy('message.createdAt', 'DESC')
      .addOrderBy('message.id', 'DESC')
      .take(take);

    if (before) {
      if (UUID_RE.test(before)) {
        const anchor = await this.messageRepo.findOne({ where: { id: before, chatId } });
        if (anchor) {
          query.andWhere(
            '(message.createdAt < :beforeAt OR (message.createdAt = :beforeAt AND message.id < :beforeId))',
            { beforeAt: anchor.createdAt, beforeId: anchor.id },
          );
        }
      } else {
        const beforeAt = new Date(before);
        if (!Number.isNaN(beforeAt.getTime())) {
          query.andWhere('message.createdAt < :beforeAt', { beforeAt });
        }
      }
    }

    return query.getMany();
  }

  createText(
    actor: DomainAccessActor,
    chatId: string,
    body: string,
    replyToMessageId: string | null = null,
  ): Promise<ChatMessageEntity> {
    return this.create(actor, chatId, ChatMessageType.Text, body, replyToMessageId);
  }

  createSystem(chatId: string, body: string): Promise<ChatMessageEntity> {
    return this.persist(chatId, null, ChatMessageType.System, body, null);
  }

  createCrmCard(
    actor: DomainAccessActor,
    chatId: string,
    type: ChatMessageType,
    refEntityType: string,
    refEntityId: string,
  ): Promise<ChatMessageEntity> {
    return this.create(actor, chatId, type, null, null, refEntityType, refEntityId);
  }

  createTyped(
    actor: DomainAccessActor,
    chatId: string,
    type: ChatMessageType,
    body: string | null = null,
    options: { broadcast?: boolean } = {},
  ): Promise<ChatMessageEntity> {
    return this.create(actor, chatId, type, body, null, null, null, options);
  }

  createAiResponse(chatId: string, body: string): Promise<ChatMessageEntity> {
    return this.persist(chatId, null, ChatMessageType.AiResponse, body, null);
  }

  async getHydrated(messageId: string): Promise<ChatMessageEntity | null> {
    return this.messageRepo.findOne({
      where: { id: messageId, deletedAt: IsNull() },
      relations: { senderUser: true, attachments: true },
    });
  }

  async broadcastCreated(message: ChatMessageEntity): Promise<void> {
    this.gateway?.emitMessageCreated(message);
    await this.notifyOfflineMembers(message);
  }

  async editOwn(actor: DomainAccessActor, messageId: string, body: string): Promise<ChatMessageEntity> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, deletedAt: IsNull() } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== actor.sub) throw new ForbiddenException('Only the sender can edit this message');
    await this.access.assertCanWrite(actor, message.chatId);
    message.body = body;
    message.editedAt = new Date();
    await this.messageRepo.save(message);
    const hydrated = await this.getHydrated(message.id);
    if (!hydrated) throw new NotFoundException('Message not found');
    this.gateway?.emitMessageUpdated(hydrated);
    return hydrated;
  }

  async softDelete(actor: DomainAccessActor, messageId: string): Promise<void> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, deletedAt: IsNull() } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== actor.sub && !this.access.isAdmin(actor)) {
      throw new ForbiddenException('Only the sender can delete this message');
    }
    await this.access.assertCanWrite(actor, message.chatId);
    await this.messageRepo.update(message.id, { deletedAt: new Date() });
    this.gateway?.emitMessageDeleted(message.chatId, message.id);
  }

  private async create(
    actor: DomainAccessActor,
    chatId: string,
    type: ChatMessageType,
    body: string | null,
    replyToMessageId: string | null,
    refEntityType: string | null = null,
    refEntityId: string | null = null,
    options: { broadcast?: boolean } = {},
  ): Promise<ChatMessageEntity> {
    await this.access.assertCanWrite(actor, chatId);
    return this.persist(
      chatId,
      actor.sub,
      type,
      body,
      replyToMessageId,
      refEntityType,
      refEntityId,
      options,
    );
  }

  /**
   * Save to PostgreSQL first, then broadcast via WebSocket.
   * DB is the source of truth; WS is delivery only.
   */
  private async persist(
    chatId: string,
    senderUserId: string | null,
    type: ChatMessageType,
    body: string | null,
    replyToMessageId: string | null,
    refEntityType: string | null = null,
    refEntityId: string | null = null,
    options: { broadcast?: boolean } = {},
  ): Promise<ChatMessageEntity> {
    const saved = await this.messageRepo.save({
      chatId,
      senderUserId,
      type,
      body,
      replyToMessageId,
      refEntityType,
      refEntityId,
      editedAt: null,
      deletedAt: null,
    });

    if (senderUserId) {
      await this.memberRepo
        .createQueryBuilder()
        .update(ChatMemberEntity)
        .set({ hiddenAt: null })
        .where('chat_id = :chatId', { chatId })
        .andWhere('user_id <> :senderUserId', { senderUserId })
        .andWhere('hidden_at IS NOT NULL')
        .execute();
    }

    const message = (await this.getHydrated(saved.id)) ?? saved;
    if (options.broadcast !== false) {
      this.gateway?.emitMessageCreated(message);
      await this.notifyOfflineMembers(message);
    }
    return message;
  }

  private async notifyOfflineMembers(message: ChatMessageEntity): Promise<void> {
    if (!message.senderUserId || message.type === ChatMessageType.System) return;
    try {
      const members = await this.memberRepo.find({ where: { chatId: message.chatId } });
      const preview =
        (message.body && message.body.trim().slice(0, 200)) ||
        (message.type === ChatMessageType.Image
          ? 'Изображение'
          : message.type === ChatMessageType.Voice
            ? 'Голосовое сообщение'
            : message.type === ChatMessageType.File
              ? 'Файл'
              : 'Новое сообщение в чате');

      for (const member of members) {
        if (member.userId === message.senderUserId) continue;
        if (this.presence.isOnline(member.userId)) continue;
        await this.notifications.create({
          userId: member.userId,
          channel: 'in_app',
          type: 'chat_message',
          title: 'Новое сообщение',
          body: preview,
          status: 'sent',
          referenceType: 'chat',
          referenceId: message.chatId,
        });
      }
    } catch (err) {
      this.logger.warn(`Offline chat notification failed: ${String(err)}`);
    }
  }
}
