import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Inject, Logger, OnModuleDestroy, OnModuleInit, Optional, forwardRef } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { entityToApiRecord } from '../../../common/utils/api-record.util';
import { JwtPayload } from '../../auth/auth.service';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatMemberEntity, ChatMessageEntity, ChatEntity } from '../entities';
import { ChatPresenceService } from '../services/chat-presence.service';
import { ChatsService } from '../services/chats.service';

type TypingKey = string;

const HEARTBEAT_STALE_MS = 60_000;
const SWEEP_INTERVAL_MS = 15_000;

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
  pingInterval: 25_000,
  pingTimeout: 60_000,
})
export class ChatGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);
  private readonly typing = new Map<TypingKey, NodeJS.Timeout>();
  private sweepTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly jwt: JwtService,
    private readonly access: ChatAccessService,
    private readonly presence: ChatPresenceService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
    @InjectRepository(ChatMemberEntity) private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(ChatEntity) private readonly chatRepo: Repository<ChatEntity>,
    @Optional()
    @Inject(forwardRef(() => ChatsService))
    private readonly chats?: ChatsService,
  ) {}

  onModuleInit(): void {
    this.sweepTimer = setInterval(() => {
      void this.sweepStalePresence();
    }, SWEEP_INTERVAL_MS);
    this.sweepTimer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.sweepTimer) clearInterval(this.sweepTimer);
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('Missing token');
      const actor = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.actor = actor;
      await client.join(`user:${actor.sub}`);
      const becameOnline = this.presence.markOnline(actor.sub, client.id);
      // Snapshot for this client so UI can hydrate before events arrive.
      client.emit('presence.sync', {
        onlineUserIds: this.presence.onlineUserIds(),
      });
      if (becameOnline) {
        this.server.emit('user.online', { userId: actor.sub });
      }
      await this.userRepo.update(actor.sub, { lastSeenAt: new Date() });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const actor = client.data.actor as JwtPayload | undefined;
    if (!actor) return;
    const stillOnline = this.presence.markOffline(actor.sub, client.id);
    if (!stillOnline) {
      this.server.emit('user.offline', { userId: actor.sub });
      await this.userRepo.update(actor.sub, { lastSeenAt: new Date() });
    }
  }

  /** Application-level heartbeat (client every ~30s). */
  @SubscribeMessage('presence:ping')
  async presencePing(@ConnectedSocket() client: Socket): Promise<{ ok: true }> {
    const actor = this.actor(client);
    const touched = this.presence.touch(actor.sub, client.id);
    if (!touched) {
      this.presence.markOnline(actor.sub, client.id);
    }
    // Keep last_seen fresh while the tab is alive (helps brief reconnect UX).
    await this.userRepo.update(actor.sub, { lastSeenAt: new Date() });
    return { ok: true };
  }

  @SubscribeMessage('chat:join')
  async joinChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ): Promise<{ chatId: string }> {
    const actor = this.actor(client);
    await this.access.assertCanRead(actor, payload.chatId);
    await client.join(`chat:${payload.chatId}`);
    return payload;
  }

  @SubscribeMessage('chat:leave')
  async leaveChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ): Promise<{ chatId: string }> {
    await client.leave(`chat:${payload.chatId}`);
    return payload;
  }

  @SubscribeMessage('typing:start')
  async typingStart(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ): Promise<void> {
    const actor = this.actor(client);
    await this.access.assertCanRead(actor, payload.chatId);
    const key = `${payload.chatId}:${actor.sub}`;
    const existing = this.typing.get(key);
    if (existing) clearTimeout(existing);
    this.server.to(`chat:${payload.chatId}`).emit('typing.start', {
      chatId: payload.chatId,
      userId: actor.sub,
    });
    this.typing.set(
      key,
      setTimeout(() => {
        this.typing.delete(key);
        this.server.to(`chat:${payload.chatId}`).emit('typing.stop', {
          chatId: payload.chatId,
          userId: actor.sub,
        });
      }, 4000),
    );
  }

  @SubscribeMessage('typing:stop')
  typingStop(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string },
  ): void {
    const actor = this.actor(client);
    const key = `${payload.chatId}:${actor.sub}`;
    const existing = this.typing.get(key);
    if (existing) clearTimeout(existing);
    this.typing.delete(key);
    this.server.to(`chat:${payload.chatId}`).emit('typing.stop', {
      chatId: payload.chatId,
      userId: actor.sub,
    });
  }

  @SubscribeMessage('message:read')
  async messageRead(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { chatId: string; messageId: string },
  ): Promise<void> {
    const actor = this.actor(client);
    if (!payload?.chatId || !payload?.messageId) return;
    await this.access.assertCanRead(actor, payload.chatId);
    // Persist receipt even if the client only emits over the socket.
    if (this.chats) {
      try {
        await this.chats.markRead(actor, payload.chatId, payload.messageId);
      } catch {
        // ignore — still broadcast read state to peers
      }
    }
    this.server.to(`chat:${payload.chatId}`).emit('message.read', {
      chatId: payload.chatId,
      userId: actor.sub,
      messageId: payload.messageId,
      readAt: new Date().toISOString(),
    });
    // markRead already emits chat.unread via ChatsService.emitUnreadSummary.
  }

  /**
   * Broadcast a new message to:
   * 1) chat room (clients currently viewing the conversation);
   * 2) each member's personal user room (so Layout badge / Chats list update
   *    even when the recipient is on another CRM page and never joined chat:*).
   * Also pushes chat.unread to recipients who are not currently in the chat room.
   */
  async emitMessageCreated(message: ChatMessageEntity): Promise<void> {
    const payload = entityToApiRecord(message);
    const chatId = message.chatId;
    this.server?.to(`chat:${chatId}`).emit('message.created', payload);

    const members = await this.memberRepo.find({ where: { chatId } });
    const recipientIds = members
      .map((row) => row.userId)
      .filter((userId) => userId && userId !== message.senderUserId);

    let viewingUserIds = new Set<string>();
    try {
      const socketsInChat = await this.server.in(`chat:${chatId}`).fetchSockets();
      viewingUserIds = new Set(
        socketsInChat
          .map((sock) => (sock.data?.actor as JwtPayload | undefined)?.sub)
          .filter((id): id is string => Boolean(id)),
      );
    } catch {
      viewingUserIds = new Set();
    }

    this.logger.log(
      `message.created chatId=${chatId} sender=${message.senderUserId ?? 'system'} ` +
        `recipients=${recipientIds.length} viewing=${viewingUserIds.size}`,
    );

    for (const member of members) {
      // Personal room — always connected while the CRM session is alive.
      this.emitToUser(member.userId, 'message.created', payload);
    }

    if (!this.chats || !message.senderUserId) return;

    // Lesson video chats must not bump the global «Чаты» unread badge.
    const chat = await this.chatRepo.findOne({
      where: { id: chatId },
      select: ['id', 'lessonId'],
    });
    if (chat?.lessonId) return;

    for (const userId of recipientIds) {
      // Viewer already gets live message + local markRead; avoid racing unread=1.
      if (viewingUserIds.has(userId)) continue;
      try {
        const user = await this.userRepo.findOne({
          where: { id: userId },
          select: ['id', 'email', 'role'],
        });
        if (!user) continue;
        const actor: JwtPayload = {
          sub: user.id,
          email: user.email,
          role: user.role,
        };
        const summary = await this.chats.unreadSummary(actor);
        this.logger.log(
          `chat.unread emit userId=${userId} chatId=${chatId} total=${summary.total}`,
        );
        this.emitToUser(userId, 'chat.unread', summary);
      } catch (err) {
        this.logger.warn(
          `chat.unread fan-out failed userId=${userId} chatId=${chatId}: ${String(err)}`,
        );
      }
    }
  }

  emitMessageUpdated(message: ChatMessageEntity): void {
    this.server
      ?.to(`chat:${message.chatId}`)
      .emit('message.updated', entityToApiRecord(message));
  }

  emitMessageDeleted(chatId: string, messageId: string): void {
    this.server?.to(`chat:${chatId}`).emit('message.deleted', { messageId, chatId });
  }

  emitToUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  private async sweepStalePresence(): Promise<void> {
    const stale = this.presence.collectStaleSockets(HEARTBEAT_STALE_MS);
    for (const { userId, socketId } of stale) {
      const sock = this.server?.sockets?.sockets?.get(socketId);
      if (sock) {
        sock.disconnect(true);
        continue;
      }
      // Socket already gone — drop from presence map.
      const stillOnline = this.presence.markOffline(userId, socketId);
      if (!stillOnline) {
        this.server?.emit('user.offline', { userId });
        await this.userRepo.update(userId, { lastSeenAt: new Date() });
      }
    }
  }

  private extractToken(client: Socket): string | null {
    const authToken = this.handshakeAuthToken(client);
    if (authToken) return authToken;
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) return queryToken;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }

  private handshakeAuthToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken;
    return null;
  }

  private actor(client: Socket): JwtPayload {
    const actor = client.data.actor as JwtPayload | undefined;
    if (!actor) throw new Error('Unauthenticated socket');
    return actor;
  }
}
