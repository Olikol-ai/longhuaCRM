import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { verify } from 'jsonwebtoken';
import { JitsiJwtService } from '../providers/jitsi-jwt.service';
import { JitsiVideoProvider } from '../providers/jitsi-video.provider';
import {
  createJitsiGuestToken,
  isAccountRequiredJitsiHost,
} from '../providers/jitsi-guest-token.util';

function jwtConfig(overrides: Record<string, string> = {}): ConfigService {
  const map: Record<string, string> = {
    'video.jitsiBaseUrl': 'https://meet.example.test',
    'video.jitsiJwtAppId': 'longhua_crm',
    'video.jitsiJwtAppSecret': 'secret-test-key',
    'video.jitsiJwtTtlSeconds': '900',
    ...overrides,
  };
  return {
    get: (key: string) => map[key],
  } as unknown as ConfigService;
}

describe('JitsiVideoProvider corporate JWT', () => {
  const config = jwtConfig();
  const jitsiJwt = new JitsiJwtService(config);
  const provider = new JitsiVideoProvider(config, jitsiJwt);

  it('creates a UUID room (not longhua-{lesson_id})', () => {
    const room = provider.createRoom({ id: '12345' });
    expect(room.provider).toBe('jitsi');
    expect(room.roomId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(room.roomId).not.toContain('longhua');
    expect(room.roomUrl).toBe(`https://meet.example.test/${room.roomId}`);
  });

  it('builds getRoomUrl from current base URL', () => {
    expect(provider.getRoomUrl('abc-room')).toBe(
      'https://meet.example.test/abc-room',
    );
  });

  it('rejects path-prefix JITSI_BASE_URL (breaks External API iframe)', () => {
    const pathConfig = jwtConfig({
      'video.jitsiBaseUrl': 'https://lk.example.test/meet',
    });
    const pathProvider = new JitsiVideoProvider(
      pathConfig,
      new JitsiJwtService(pathConfig),
    );
    expect(() =>
      pathProvider.generateAccessData({
        roomId: 'room-1',
        displayName: 'Учитель',
        userId: 'u1',
        roleLabel: 'преподаватель',
        isModerator: true,
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('always issues CRM JWT with displayName and moderator flag', () => {
    const access = provider.generateAccessData({
      roomId: 'room-1',
      displayName: 'Иван (преподаватель)',
      userId: 'user-1',
      roleLabel: 'преподаватель',
      isModerator: true,
      subject: 'HSK 2. Урок 5',
    });
    expect(access.token).toBeTruthy();
    expect(access.hostRequiresAccount).toBe(false);
    expect(access.domain).toBe('meet.example.test');
    const payload = verify(access.token as string, 'secret-test-key') as {
      context: {
        user: { name: string; moderator: boolean; id?: string; role?: string };
      };
      room: string;
      jti: string;
    };
    expect(payload.room).toBe('room-1');
    expect(payload.context.user.name).toBe('Иван (преподаватель)');
    expect(payload.context.user.moderator).toBe(true);
    expect(payload.context.user.id).toBe('user-1');
    expect(payload.context.user.role).toBe('преподаватель');
    expect(payload.jti).toBeTruthy();
  });

  it('rejects public meet.jit.si even when JWT secrets exist', () => {
    const publicConfig = jwtConfig({
      'video.jitsiBaseUrl': 'https://meet.jit.si',
    });
    const publicProvider = new JitsiVideoProvider(
      publicConfig,
      new JitsiJwtService(publicConfig),
    );

    expect(() =>
      publicProvider.generateAccessData({
        roomId: 'room-9',
        displayName: 'Учитель',
        userId: 't1',
        roleLabel: 'преподаватель',
        isModerator: true,
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('requires JWT secrets', () => {
    const bare = jwtConfig({
      'video.jitsiJwtAppId': '',
      'video.jitsiJwtAppSecret': '',
    });
    const bareProvider = new JitsiVideoProvider(bare, new JitsiJwtService(bare));
    expect(() => bareProvider.createRoom({ id: 'x' })).toThrow(
      ServiceUnavailableException,
    );
  });

  it('deleteRoom is a no-op', () => {
    expect(() => provider.deleteRoom('room-1')).not.toThrow();
  });
});

describe('jitsi guest token util', () => {
  it('detects account-required public hosts', () => {
    expect(isAccountRequiredJitsiHost('meet.jit.si')).toBe(true);
    expect(isAccountRequiredJitsiHost('meet.example.test')).toBe(false);
  });

  it('signs a guest token with display name and moderator flag', () => {
    const token = createJitsiGuestToken({
      appId: 'longhua_crm',
      appSecret: 'secret',
      roomName: 'room-1',
      userId: 'u1',
      displayName: 'Пётр',
      isModerator: true,
      subject: 'Урок',
    });
    const payload = verify(token, 'secret') as {
      context: { user: { moderator: boolean; name: string } };
    };
    expect(payload.context.user.moderator).toBe(true);
    expect(payload.context.user.name).toBe('Пётр');
  });
});
