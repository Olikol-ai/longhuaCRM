import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { NotificationsService } from '../../notifications/notifications.service';
import { TelegramService } from '../../telegram/telegram.service';
import { UserEntity } from '../../users/entities/user.entity';
import { DirectChatRequestEntity, ChatMemberEntity } from '../entities';
import { DirectChatRequestStatus } from '../enums/chat.enums';
import { ChatGateway } from '../gateway/chat.gateway';
import { ChatPrivacyService } from '../../../common/access/chat-privacy.service';
import { ChatMembershipSyncService } from './chat-membership-sync.service';

@Injectable()
export class DirectChatRequestService {
  private readonly logger = new Logger(DirectChatRequestService.name);

  constructor(
    @InjectRepository(DirectChatRequestEntity)
    private readonly requests: Repository<DirectChatRequestEntity>,
    @InjectRepository(ChatMemberEntity)
    private readonly members: Repository<ChatMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly users: Repository<UserEntity>,
    private readonly privacy: ChatPrivacyService,
    private readonly membershipSync: ChatMembershipSyncService,
    private readonly notifications: NotificationsService,
    private readonly telegram: TelegramService,
    @Optional() private readonly gateway?: ChatGateway,
  ) {}

  async create(
    actor: DomainAccessActor,
    toUserId: string,
    message?: string | null,
  ): Promise<DirectChatRequestEntity> {
    await this.privacy.assertCanReceiveDmRequest(actor.sub, toUserId);

    const pending = await this.requests.findOne({
      where: {
        fromUserId: actor.sub,
        toUserId,
        status: DirectChatRequestStatus.Pending,
      },
    });
    if (pending) {
      throw new BadRequestException('Запрос уже ожидает ответа');
    }

    const trimmed = message?.trim() || null;
    if (trimmed && trimmed.length > 500) {
      throw new BadRequestException('Сообщение не длиннее 500 символов');
    }

    const saved = await this.requests.save({
      fromUserId: actor.sub,
      toUserId,
      status: DirectChatRequestStatus.Pending,
      message: trimmed,
      respondedAt: null,
      expiresAt: this.privacy.computeExpiresAt(),
      createdChatId: null,
    });

    this.gateway?.emitToUser(toUserId, 'chat.request.created', this.toDto(saved));
    void this.notifyIncoming(saved);
    return this.getById(saved.id);
  }

  async listIncoming(
    actor: DomainAccessActor,
    status?: DirectChatRequestStatus,
  ): Promise<DirectChatRequestEntity[]> {
    return this.requests.find({
      where: {
        toUserId: actor.sub,
        ...(status ? { status } : {}),
      },
      relations: { fromUser: true },
      order: { createdAt: 'DESC' },
    });
  }

  async listOutgoing(
    actor: DomainAccessActor,
    status?: DirectChatRequestStatus,
  ): Promise<DirectChatRequestEntity[]> {
    return this.requests.find({
      where: {
        fromUserId: actor.sub,
        ...(status ? { status } : {}),
      },
      relations: { toUser: true },
      order: { createdAt: 'DESC' },
    });
  }

  async accept(actor: DomainAccessActor, requestId: string): Promise<DirectChatRequestEntity> {
    const request = await this.requireRequest(requestId);
    if (request.toUserId !== actor.sub && !this.isAdmin(actor)) {
      throw new ForbiddenException('Только получатель может принять запрос');
    }
    if (request.status !== DirectChatRequestStatus.Pending) {
      throw new BadRequestException('Запрос уже обработан');
    }
    await this.privacy.assertNotBlocked(request.fromUserId, request.toUserId);

    const chat = await this.membershipSync.findOrCreateDirect(
      request.fromUserId,
      request.toUserId,
    );
    await this.unhideMembers(chat.id, [request.fromUserId, request.toUserId]);

    request.status = DirectChatRequestStatus.Accepted;
    request.respondedAt = new Date();
    request.createdChatId = chat.id;
    const saved = await this.requests.save(request);

    this.gateway?.emitToUser(request.fromUserId, 'chat.request.accepted', {
      ...this.toDto(saved),
      chat,
    });
    this.gateway?.emitToUser(request.toUserId, 'chat.request.accepted', {
      ...this.toDto(saved),
      chat,
    });
    this.gateway?.emitToUser(request.fromUserId, 'chat.created', chat);
    this.gateway?.emitToUser(request.toUserId, 'chat.created', chat);
    return this.getById(saved.id);
  }

  async decline(actor: DomainAccessActor, requestId: string): Promise<DirectChatRequestEntity> {
    const request = await this.requireRequest(requestId);
    if (request.toUserId !== actor.sub && !this.isAdmin(actor)) {
      throw new ForbiddenException('Только получатель может отклонить запрос');
    }
    if (request.status !== DirectChatRequestStatus.Pending) {
      throw new BadRequestException('Запрос уже обработан');
    }
    request.status = DirectChatRequestStatus.Declined;
    request.respondedAt = new Date();
    const saved = await this.requests.save(request);
    this.gateway?.emitToUser(request.fromUserId, 'chat.request.declined', this.toDto(saved));
    return saved;
  }

  async cancel(actor: DomainAccessActor, requestId: string): Promise<DirectChatRequestEntity> {
    const request = await this.requireRequest(requestId);
    if (request.fromUserId !== actor.sub && !this.isAdmin(actor)) {
      throw new ForbiddenException('Только отправитель может отменить запрос');
    }
    if (request.status !== DirectChatRequestStatus.Pending) {
      throw new BadRequestException('Запрос уже обработан');
    }
    request.status = DirectChatRequestStatus.Cancelled;
    request.respondedAt = new Date();
    const saved = await this.requests.save(request);
    this.gateway?.emitToUser(request.toUserId, 'chat.request.cancelled', this.toDto(saved));
    return saved;
  }

  async expirePending(): Promise<number> {
    const now = new Date();
    const result = await this.requests
      .createQueryBuilder()
      .update(DirectChatRequestEntity)
      .set({ status: DirectChatRequestStatus.Expired, respondedAt: now })
      .where('status = :status', { status: DirectChatRequestStatus.Pending })
      .andWhere('expires_at IS NOT NULL AND expires_at < :now', { now })
      .execute();
    return result.affected ?? 0;
  }

  private async notifyIncoming(request: DirectChatRequestEntity): Promise<void> {
    try {
      const from = await this.users.findOne({ where: { id: request.fromUserId } });
      const fromName =
        [from?.lastName, from?.firstName].filter(Boolean).join(' ').trim() ||
        from?.email ||
        'Пользователь';
      const title = 'Запрос на переписку';
      const body = `${fromName} хочет начать личный чат с вами. Откройте раздел «Чаты».`;

      await this.notifications.create({
        userId: request.toUserId,
        channel: 'in_app',
        type: 'direct_chat_request',
        title,
        body,
        status: 'sent',
        referenceType: 'direct_chat_request',
        referenceId: request.id,
      });

      const to = await this.users.findOne({ where: { id: request.toUserId } });
      if (to?.telegramId) {
        await this.telegram.sendMessage(
          to.telegramId,
          `${title}\n\n${body}`,
        );
      }
    } catch (err) {
      this.logger.warn(`Failed to notify DM request ${request.id}: ${String(err)}`);
    }
  }

  private async unhideMembers(chatId: string, userIds: string[]): Promise<void> {
    await this.members
      .createQueryBuilder()
      .update(ChatMemberEntity)
      .set({ hiddenAt: null })
      .where('chat_id = :chatId', { chatId })
      .andWhere('user_id IN (:...userIds)', { userIds })
      .execute();
  }

  private async requireRequest(id: string): Promise<DirectChatRequestEntity> {
    const row = await this.requests.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Запрос не найден');
    return row;
  }

  private async getById(id: string): Promise<DirectChatRequestEntity> {
    return this.requireRequest(id);
  }

  private isAdmin(actor: DomainAccessActor): boolean {
    return actor.role === 'admin';
  }

  private toDto(row: DirectChatRequestEntity) {
    return {
      id: row.id,
      fromUserId: row.fromUserId,
      toUserId: row.toUserId,
      status: row.status,
      message: row.message,
      createdChatId: row.createdChatId,
      createdAt: row.createdAt,
      respondedAt: row.respondedAt,
      expiresAt: row.expiresAt,
    };
  }
}
