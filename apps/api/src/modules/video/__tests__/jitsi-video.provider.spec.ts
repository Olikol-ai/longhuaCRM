import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JitsiVideoProvider } from '../providers/jitsi-video.provider';
import {
  createJitsiGuestToken,
  isAccountRequiredJitsiHost,
} from '../providers/jitsi-guest-token.util';
import { verify } from 'jsonwebtoken';

describe('JitsiVideoProvider guest access', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'video.jitsiBaseUrl') return 'https://meet.example.test';
      if (key === 'video.jitsiJwtAppId') return '';
      if (key === 'video.jitsiJwtAppSecret') return '';
      return undefined;
    }),
  } as unknown as ConfigService;

  const provider = new JitsiVideoProvider(config);

  it('creates a room named longhua-{lesson_id} on guest host', () => {
    const room = provider.createRoom({ id: '12345' });
    expect(room.provider).toBe('jitsi');
    expect(room.roomId).toBe('longhua-12345');
    expect(room.roomUrl).toBe('https://meet.example.test/longhua-12345');
  });

  it('builds getRoomUrl from current base URL', () => {
    expect(provider.getRoomUrl('longhua-abc')).toBe(
      'https://meet.example.test/longhua-abc',
    );
  });

  it('generates guest access with displayName, role and subject (no account)', () => {
    const access = provider.generateAccessData({
      roomId: 'longhua-1',
      roomUrl: 'https://meet.jit.si/longhua-1',
      displayName: 'Иван (преподаватель)',
      userId: 'user-1',
      roleLabel: 'преподаватель',
      isModerator: true,
      subject: 'HSK 2. Урок 5',
    });
    expect(access.provider).toBe('jitsi');
    expect(access.domain).toBe('meet.example.test');
    expect(access.roomUrl).toBe('https://meet.example.test/longhua-1');
    expect(access.hostRequiresAccount).toBe(false);
    expect(access.token).toBeNull();
    expect(access.subject).toBe('HSK 2. Урок 5');
    expect(access.roleLabel).toBe('преподаватель');
    expect(access.displayName).toBe('Иван (преподаватель)');
  });

  it('issues CRM guest JWT when JWT secrets are configured', () => {
    const withJwt = new JitsiVideoProvider({
      get: (key: string) => {
        if (key === 'video.jitsiBaseUrl') return 'https://meet.example.test';
        if (key === 'video.jitsiJwtAppId') return 'longhua_crm';
        if (key === 'video.jitsiJwtAppSecret') return 'secret-test-key';
        return undefined;
      },
    } as unknown as ConfigService);

    const access = withJwt.generateAccessData({
      roomId: 'longhua-9',
      displayName: 'Анна (ученик)',
      userId: 'stu-1',
      roleLabel: 'ученик',
      isModerator: false,
      subject: 'Онлайн-урок',
    });

    expect(access.token).toBeTruthy();
    const payload = verify(access.token as string, 'secret-test-key') as {
      context: { user: { name: string; moderator: boolean } };
      room: string;
    };
    expect(payload.room).toBe('longhua-9');
    expect(payload.context.user.name).toBe('Анна (ученик)');
    expect(payload.context.user.moderator).toBe(false);
    expect(access.hostRequiresAccount).toBe(false);
  });

  it('rejects public meet.jit.si without CRM guest JWT', () => {
    const publicProvider = new JitsiVideoProvider({
      get: (key: string) => {
        if (key === 'video.jitsiBaseUrl') return 'https://meet.jit.si';
        return '';
      },
    } as unknown as ConfigService);

    expect(() =>
      publicProvider.generateAccessData({
        roomId: 'longhua-9',
        displayName: 'Учитель',
        userId: 't1',
        roleLabel: 'преподаватель',
        isModerator: true,
      }),
    ).toThrow(ServiceUnavailableException);
  });

  it('deleteRoom is a no-op', () => {
    expect(() => provider.deleteRoom('longhua-1')).not.toThrow();
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
      roomName: 'longhua-1',
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
