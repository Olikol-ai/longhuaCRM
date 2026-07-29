import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Server, Socket } from 'socket.io';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { JwtPayload } from '../../auth/auth.service';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatMessageEntity } from '../entities';

type TypingKey = string;

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: true, credentials: true },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly onlineUsers = new Map<string, Set<string>>();
  private readonly typing = new Map<TypingKey, NodeJS.Timeout>();

  constructor(
    private readonly jwt: JwtService,
    private readonly access: ChatAccessService,
    @InjectRepository(UserEntity) private readonly userRepo: Repository<UserEntity>,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token = this.extractToken(client);
      if (!token) throw new Error('Missing token');
      const actor = await this.jwt.verifyAsync<JwtPayload>(token);
      client.data.actor = actor;
      await client.join(`user:${actor.sub}`);
      this.markOnline(actor.sub, client.id);
      this.server.emit('user:online', { userId: actor.sub });
      await this.userRepo.update(actor.sub, { lastSeenAt: new Date() });
    } catch {
      client.disconnect(true);
    }
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const actor = client.data.actor as JwtPayload | undefined;
    if (!actor) return;
    const stillOnline = this.markOffline(actor.sub, client.id);
    if (!stillOnline) {
      this.server.emit('user:offline', { userId: actor.sub });
      await this.userRepo.update(actor.sub, { lastSeenAt: new Date() });
    }
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
    this.server.to(`chat:${payload.chatId}`).emit('typing:start', {
      chatId: payload.chatId,
      userId: actor.sub,
    });
    this.typing.set(
      key,
      setTimeout(() => {
        this.typing.delete(key);
        this.server.to(`chat:${payload.chatId}`).emit('typing:stop', {
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
    this.server.to(`chat:${payload.chatId}`).emit('typing:stop', {
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
    await this.access.assertCanRead(actor, payload.chatId);
    this.server.to(`chat:${payload.chatId}`).emit('message:read', {
      chatId: payload.chatId,
      userId: actor.sub,
      messageId: payload.messageId,
      readAt: new Date().toISOString(),
    });
  }

  emitMessageCreated(message: ChatMessageEntity): void {
    this.server?.to(`chat:${message.chatId}`).emit('message:created', message);
  }

  emitMessageUpdated(message: ChatMessageEntity): void {
    this.server?.to(`chat:${message.chatId}`).emit('message:updated', message);
  }

  emitMessageDeleted(chatId: string, messageId: string): void {
    this.server?.to(`chat:${chatId}`).emit('message:deleted', { messageId, chatId });
  }

  private extractToken(client: Socket): string | null {
    const authToken = client.handshake.auth?.token;
    if (typeof authToken === 'string' && authToken.trim()) return authToken;
    const queryToken = client.handshake.query?.token;
    if (typeof queryToken === 'string' && queryToken.trim()) return queryToken;
    const header = client.handshake.headers.authorization;
    if (typeof header === 'string' && header.startsWith('Bearer ')) {
      return header.slice(7);
    }
    return null;
  }

  private markOnline(userId: string, socketId: string): void {
    const set = this.onlineUsers.get(userId) ?? new Set<string>();
    set.add(socketId);
    this.onlineUsers.set(userId, set);
  }

  private markOffline(userId: string, socketId: string): boolean {
    const set = this.onlineUsers.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.onlineUsers.delete(userId);
      return false;
    }
    return true;
  }

  private actor(client: Socket): JwtPayload {
    const actor = client.data.actor as JwtPayload | undefined;
    if (!actor) throw new Error('Unauthenticated socket');
    return actor;
  }
}
