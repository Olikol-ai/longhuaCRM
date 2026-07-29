import { Injectable } from '@nestjs/common';

/**
 * In-memory online presence shared by ChatGateway and REST list/detail.
 */
@Injectable()
export class ChatPresenceService {
  private readonly onlineUsers = new Map<string, Set<string>>();

  markOnline(userId: string, socketId: string): void {
    const set = this.onlineUsers.get(userId) ?? new Set<string>();
    set.add(socketId);
    this.onlineUsers.set(userId, set);
  }

  /** Returns true if user still has other sockets online. */
  markOffline(userId: string, socketId: string): boolean {
    const set = this.onlineUsers.get(userId);
    if (!set) return false;
    set.delete(socketId);
    if (set.size === 0) {
      this.onlineUsers.delete(userId);
      return false;
    }
    return true;
  }

  isOnline(userId: string): boolean {
    return (this.onlineUsers.get(userId)?.size ?? 0) > 0;
  }

  onlineUserIds(userIds: string[]): string[] {
    return userIds.filter((id) => this.isOnline(id));
  }

  countOnline(userIds: string[]): number {
    return this.onlineUserIds(userIds).length;
  }
}
