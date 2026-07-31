import {
  BadRequestException,
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
import { ChatEntity, ChatMemberEntity, ChatMessageEntity } from '../entities';
import { ChatKind, ChatMessageType } from '../enums/chat.enums';
import { ChatGateway } from '../gateway/chat.gateway';
import { E2EE_ALGORITHM } from './user-crypto.service';
import { ChatMembershipSyncService } from './chat-membership-sync.service';
import { ChatPresenceService } from './chat-presence.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type EncryptedTextPayload = {
  ciphertext: string;
  nonce: string;
  algorithm: string;
  keyVersion: number;
  replyToMessageId?: string | null;
};

@Injectable()
export class ChatMessagesService {
  private readonly logger = new Logger(ChatMessagesService.name);

  constructor(
    @InjectRepository(ChatMessageEntity) private readonly messageRepo: Repository<ChatMessageEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    private readonly access: ChatAccessService,
    private readonly presence: ChatPresenceService,
    private readonly notifications: NotificationsService,
    private readonly membershipSync: ChatMembershipSyncService,
    @Optional() private readonly gateway?: ChatGateway,
  ) {}

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

  async createText(
    actor: DomainAccessActor,
    chatId: string,
    body: string,
    replyToMessageId: string | null = null,
  ): Promise<ChatMessageEntity> {
    const chat = await this.access.assertCanWrite(actor, chatId);
    if (chat.kind === ChatKind.Direct) {
      throw new BadRequestException(
        'Direct chats require end-to-end encryption. Send ciphertext, nonce, algorithm, and keyVersion.',
      );
    }
    if (!body?.trim()) throw new BadRequestException('body is required');
    return this.persist(chatId, actor.sub, ChatMessageType.Text, body.trim(), replyToMessageId);
  }

  async createEncryptedText(
    actor: DomainAccessActor,
    chatId: string,
    payload: EncryptedTextPayload,
  ): Promise<ChatMessageEntity> {
    const chat = await this.access.assertCanWrite(actor, chatId);
    if (chat.kind !== ChatKind.Direct) {
      throw new BadRequestException('Encrypted payload is only accepted for Direct chats');
    }
    if (!payload.ciphertext?.trim() || !payload.nonce?.trim()) {
      throw new BadRequestException('ciphertext and nonce are required');
    }
    const algorithm = payload.algorithm?.trim() || E2EE_ALGORITHM;
    if (algorithm !== E2EE_ALGORITHM) {
      throw new BadRequestException(`Unsupported encryption algorithm: ${algorithm}`);
    }
    if (!payload.keyVersion || payload.keyVersion < 1) {
      throw new BadRequestException('keyVersion is required');
    }

    return this.persist(
      chatId,
      actor.sub,
      ChatMessageType.Text,
      null,
      payload.replyToMessageId ?? null,
      null,
      null,
      {},
      {
        ciphertext: payload.ciphertext.trim(),
        nonce: payload.nonce.trim(),
        encryptionAlgorithm: algorithm,
        keyVersion: payload.keyVersion,
      },
    );
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

  async editOwn(
    actor: DomainAccessActor,
    messageId: string,
    patch: {
      body?: string;
      ciphertext?: string;
      nonce?: string;
      algorithm?: string;
      keyVersion?: number;
    },
  ): Promise<ChatMessageEntity> {
    const message = await this.messageRepo.findOne({ where: { id: messageId, deletedAt: IsNull() } });
    if (!message) throw new NotFoundException('Message not found');
    if (message.senderUserId !== actor.sub) {
      throw new ForbiddenException('Only the sender can edit this message');
    }
    const chat = await this.access.assertCanWrite(actor, message.chatId);

    if (chat.kind === ChatKind.Direct) {
      if (!patch.ciphertext?.trim() || !patch.nonce?.trim()) {
        throw new BadRequestException('Direct message edits require ciphertext and nonce');
      }
      message.body = null;
      message.ciphertext = patch.ciphertext.trim();
      message.nonce = patch.nonce.trim();
      message.encryptionAlgorithm = patch.algorithm?.trim() || E2EE_ALGORITHM;
      message.keyVersion = patch.keyVersion ?? message.keyVersion ?? 1;
    } else {
      if (!patch.body?.trim()) throw new BadRequestException('body is required');
      message.body = patch.body.trim();
      message.ciphertext = null;
      message.nonce = null;
      message.encryptionAlgorithm = null;
      message.keyVersion = null;
    }

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
    const chat = await this.chatRepo.findOne({ where: { id: message.chatId } });
    if (chat?.kind === ChatKind.Direct) {
      if (message.senderUserId !== actor.sub) {
        throw new ForbiddenException('Only the sender can delete Direct messages');
      }
    } else if (message.senderUserId !== actor.sub && !this.access.isAdmin(actor)) {
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
    const chat = await this.access.assertCanWrite(actor, chatId);
    if (chat.kind === ChatKind.Direct && type === ChatMessageType.Text && body) {
      throw new BadRequestException(
        'Direct chats require end-to-end encryption. Send ciphertext instead of body.',
      );
    }
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

  private async persist(
    chatId: string,
    senderUserId: string | null,
    type: ChatMessageType,
    body: string | null,
    replyToMessageId: string | null,
    refEntityType: string | null = null,
    refEntityId: string | null = null,
    options: { broadcast?: boolean } = {},
    e2ee?: {
      ciphertext: string;
      nonce: string;
      encryptionAlgorithm: string;
      keyVersion: number;
    },
  ): Promise<ChatMessageEntity> {
    const saved = await this.messageRepo.save({
      chatId,
      senderUserId,
      type,
      body,
      ciphertext: e2ee?.ciphertext ?? null,
      nonce: e2ee?.nonce ?? null,
      encryptionAlgorithm: e2ee?.encryptionAlgorithm ?? null,
      keyVersion: e2ee?.keyVersion ?? null,
      replyToMessageId,
      refEntityType,
      refEntityId,
      editedAt: null,
      deletedAt: null,
    });

    if (senderUserId) {
      // Sender has seen their own message — advance read cursor so older
      // peer messages do not stay "unread" after they participate in the chat.
      await this.membershipSync.addMember(chatId, senderUserId);
      await this.memberRepo.update(
        { chatId, userId: senderUserId },
        { lastReadMessageId: saved.id, lastReadAt: saved.createdAt, hiddenAt: null },
      );
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
      const chat = await this.chatRepo.findOne({ where: { id: message.chatId } });
      const members = await this.memberRepo.find({ where: { chatId: message.chatId } });
      const preview =
        chat?.kind === ChatKind.Direct || message.ciphertext
          ? 'Новое зашифрованное сообщение'
          : (message.body && message.body.trim().slice(0, 200)) ||
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
