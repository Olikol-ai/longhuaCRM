import { Injectable } from '@nestjs/common';

export type StaleSocket = { userId: string; socketId: string };

const DEFAULT_STALE_MS = 60_000;

/**
 * In-memory CRM presence: one logical online user per userId,
 * backed by one or more active socket connections (tabs/devices).
 * Heartbeat keeps sockets fresh; stale sockets are swept offline.
 */
@Injectable()
export class ChatPresenceService {
  /** userId → socketId → lastHeartbeatMs */
  private readonly connections = new Map<string, Map<string, number>>();

  /** @returns true if this was the first socket (user just became online). */
  markOnline(userId: string, socketId: string): boolean {
    const wasOnline = this.isOnline(userId);
    let sockets = this.connections.get(userId);
    if (!sockets) {
      sockets = new Map();
      this.connections.set(userId, sockets);
    }
    sockets.set(socketId, Date.now());
    return !wasOnline;
  }

  touch(userId: string, socketId: string): boolean {
    const sockets = this.connections.get(userId);
    if (!sockets?.has(socketId)) return false;
    sockets.set(socketId, Date.now());
    return true;
  }

  /**
   * Remove a socket. Returns true if the user remains online via other sockets.
   */
  markOffline(userId: string, socketId: string): boolean {
    const sockets = this.connections.get(userId);
    if (!sockets) return false;
    sockets.delete(socketId);
    if (sockets.size === 0) {
      this.connections.delete(userId);
      return false;
    }
    return true;
  }

  isOnline(userId: string): boolean {
    return (this.connections.get(userId)?.size ?? 0) > 0;
  }

  onlineUserIds(userIds?: string[]): string[] {
    if (userIds) {
      return userIds.filter((id) => this.isOnline(id));
    }
    return [...this.connections.keys()];
  }

  countOnline(userIds: string[]): number {
    return this.onlineUserIds(userIds).length;
  }

  /**
   * List sockets that missed heartbeat longer than staleMs.
   * Does not mutate state — gateway disconnects / markOffline.
   */
  collectStaleSockets(staleMs = DEFAULT_STALE_MS): StaleSocket[] {
    const now = Date.now();
    const stale: StaleSocket[] = [];
    for (const [userId, sockets] of this.connections) {
      for (const [socketId, lastBeat] of sockets) {
        if (now - lastBeat > staleMs) {
          stale.push({ userId, socketId });
        }
      }
    }
    return stale;
  }
}
