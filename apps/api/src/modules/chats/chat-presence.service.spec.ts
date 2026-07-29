import { ChatPresenceService } from './services/chat-presence.service';

describe('ChatPresenceService', () => {
  it('tracks online sockets and counts intersection with members', () => {
    const presence = new ChatPresenceService();
    presence.markOnline('u1', 's1');
    presence.markOnline('u2', 's2');
    presence.markOnline('u2', 's3');

    expect(presence.isOnline('u1')).toBe(true);
    expect(presence.countOnline(['u1', 'u2', 'u3'])).toBe(2);
    expect(presence.onlineUserIds(['u1', 'u3'])).toEqual(['u1']);

    expect(presence.markOffline('u2', 's2')).toBe(true);
    expect(presence.isOnline('u2')).toBe(true);
    expect(presence.markOffline('u2', 's3')).toBe(false);
    expect(presence.isOnline('u2')).toBe(false);
    expect(presence.countOnline(['u1', 'u2'])).toBe(1);
  });
});
