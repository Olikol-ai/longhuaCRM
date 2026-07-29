import { ForbiddenException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { ChatMessageEntity } from '../entities';
import { ChatMessageType } from '../enums/chat.enums';
import { ChatGateway } from '../gateway/chat.gateway';

@Injectable()
export class ChatMessagesService {
  constructor(
    @InjectRepository(ChatMessageEntity) private readonly messageRepo: Repository<ChatMessageEntity>,
    private readonly access: ChatAccessService,
    @Optional() private readonly gateway?: ChatGateway,
  ) {}

  async list(actor: DomainAccessActor, chatId: string, limit = 50, before?: Date): Promise<ChatMessageEntity[]> {
    await this.access.assertCanRead(actor, chatId);
    const query = this.messageRepo.createQueryBuilder('message')
      .leftJoinAndSelect('message.attachments', 'attachment')
      .leftJoinAndSelect('message.senderUser', 'sender')
      .where('message.chat_id = :chatId', { chatId })
      .andWhere('message.deleted_at IS NULL')
      .orderBy('message.created_at', 'DESC')
      .take(Math.min(Math.max(limit, 1), 100));
    if (before) query.andWhere('message.created_at < :before', { before });
    return query.getMany();
  }

  createText(actor: DomainAccessActor, chatId: string, body: string, replyToMessageId: string | null = null): Promise<ChatMessageEntity> {
    return this.create(actor, chatId, ChatMessageType.Text, body, replyToMessageId);
  }

  createSystem(chatId: string, body: string): Promise<ChatMessageEntity> {
    return this.persist(chatId, null, ChatMessageType.System, body, null);
  }

  createCrmCard(actor: DomainAccessActor, chatId: string, type: ChatMessageType, refEntityType: string, refEntityId: string): Promise<ChatMessageEntity> {
    return this.create(actor, chatId, type, null, null, refEntityType, refEntityId);
  }

  createTyped(
    actor: DomainAccessActor,
    chatId: string,
    type: ChatMessageType,
    body: string | null = null,
  ): Promise<ChatMessageEntity> {
    return this.create(actor, chatId, type, body, null);
  }

  createAiResponse(chatId: string, body: string): Promise<ChatMessageEntity> {
    return this.persist(chatId, null, ChatMessageType.AiResponse, body, null);
  }

  async editOwn(actor: DomainAccessActor, messageId: string, body: string): Promise<ChatMessageEntity> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, deletedAt: IsNull() } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== actor.sub) throw new ForbiddenException('Only the sender can edit this message');
    await this.access.assertCanWrite(actor, message.chatId);
    message.body = body;
    message.editedAt = new Date();
    const saved = await this.messageRepo.save(message);
    this.gateway?.emitMessageUpdated(saved);
    return saved;
  }

  async softDelete(actor: DomainAccessActor, messageId: string): Promise<void> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, deletedAt: IsNull() } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== actor.sub && !this.access.isAdmin(actor)) throw new ForbiddenException('Only the sender can delete this message');
    await this.access.assertCanWrite(actor, message.chatId);
    await this.messageRepo.update(message.id, { deletedAt: new Date() });
    this.gateway?.emitMessageDeleted(message.chatId, message.id);
  }

  private async create(actor: DomainAccessActor, chatId: string, type: ChatMessageType, body: string | null, replyToMessageId: string | null, refEntityType: string | null = null, refEntityId: string | null = null): Promise<ChatMessageEntity> {
    await this.access.assertCanWrite(actor, chatId);
    return this.persist(chatId, actor.sub, type, body, replyToMessageId, refEntityType, refEntityId);
  }

  private async persist(chatId: string, senderUserId: string | null, type: ChatMessageType, body: string | null, replyToMessageId: string | null, refEntityType: string | null = null, refEntityId: string | null = null): Promise<ChatMessageEntity> {
    const message = await this.messageRepo.save({ chatId, senderUserId, type, body, replyToMessageId, refEntityType, refEntityId, editedAt: null, deletedAt: null });
    this.gateway?.emitMessageCreated(message);
    return message;
  }
}
