import { ConfigService } from '@nestjs/config';
import { JitsiVideoProvider } from '../providers/jitsi-video.provider';

describe('JitsiVideoProvider', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'video.jitsiBaseUrl') return 'https://meet.example.test';
      return undefined;
    }),
  } as unknown as ConfigService;

  const provider = new JitsiVideoProvider(config);

  it('creates a room named longhua-{lesson_id}', () => {
    const room = provider.createRoom({ id: '12345' });
    expect(room.provider).toBe('jitsi');
    expect(room.roomId).toBe('longhua-12345');
    expect(room.roomUrl).toBe('https://meet.example.test/longhua-12345');
  });

  it('builds getRoomUrl from room id', () => {
    expect(provider.getRoomUrl('longhua-abc')).toBe(
      'https://meet.example.test/longhua-abc',
    );
  });

  it('generates External API access data with display name', () => {
    const access = provider.generateAccessData({
      roomId: 'longhua-1',
      roomUrl: 'https://meet.example.test/longhua-1',
      displayName: 'Иван',
    });
    expect(access.provider).toBe('jitsi');
    expect(access.roomId).toBe('longhua-1');
    expect(access.domain).toBe('meet.example.test');
    expect(access.roomName).toBe('longhua-1');
    expect(access.externalApiUrl).toBe('https://meet.example.test/external_api.js');
    expect(access.hostRequiresAccount).toBe(false);
    expect(access.embedUrl).toContain('userInfo.displayName=');
    expect(access.token).toBeNull();
  });

  it('marks meet.jit.si as account-required host', () => {
    const publicProvider = new JitsiVideoProvider({
      get: () => 'https://meet.jit.si',
    } as unknown as ConfigService);
    const access = publicProvider.generateAccessData({
      roomId: 'longhua-9',
      roomUrl: 'https://meet.jit.si/longhua-9',
      displayName: 'Учитель',
    });
    expect(access.hostRequiresAccount).toBe(true);
    expect(access.domain).toBe('meet.jit.si');
  });

  it('deleteRoom is a no-op', () => {
    expect(() => provider.deleteRoom('longhua-1')).not.toThrow();
  });
});
