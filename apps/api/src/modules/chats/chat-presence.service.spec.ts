import { ChatPresenceService } from './services/chat-presence.service';

describe('ChatPresenceService', () => {
  it('tracks online sockets and counts intersection with members', () => {
    const presence = new ChatPresenceService();
    expect(presence.markOnline('u1', 's1')).toBe(true);
    expect(presence.markOnline('u2', 's2')).toBe(true);
    expect(presence.markOnline('u2', 's3')).toBe(false);

    expect(presence.isOnline('u1')).toBe(true);
    expect(presence.countOnline(['u1', 'u2', 'u3'])).toBe(2);
    expect(presence.onlineUserIds(['u1', 'u3'])).toEqual(['u1']);
    expect(presence.onlineUserIds().sort()).toEqual(['u1', 'u2']);

    expect(presence.markOffline('u2', 's2')).toBe(true);
    expect(presence.isOnline('u2')).toBe(true);
    expect(presence.markOffline('u2', 's3')).toBe(false);
    expect(presence.isOnline('u2')).toBe(false);
    expect(presence.countOnline(['u1', 'u2'])).toBe(1);
  });

  it('touches heartbeat and reports stale sockets', () => {
    const presence = new ChatPresenceService();
    presence.markOnline('u1', 's1');
    presence.markOnline('u1', 's2');
    const sockets = (presence as unknown as { connections: Map<string, Map<string, number>> })
      .connections.get('u1')!;
    sockets.set('s1', Date.now() - 70_000);
    sockets.set('s2', Date.now());

    const stale = presence.collectStaleSockets(60_000);
    expect(stale).toEqual([{ userId: 'u1', socketId: 's1' }]);

    expect(presence.touch('u1', 's1')).toBe(true);
    expect(presence.collectStaleSockets(60_000)).toEqual([]);
  });
});
