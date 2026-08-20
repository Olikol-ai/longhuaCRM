import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  E2EE_ALGORITHM,
  E2EE_KDF,
  E2EE_KDF_SERVER_HOLD,
  UserCryptoService,
} from './services/user-crypto.service';

describe('UserCryptoService ensure/activate', () => {
  function build() {
    const store = new Map<string, Record<string, unknown>>();
    const cryptoRepo = {
      findOne: jest.fn(async ({ where }: { where: { userId: string } }) =>
        store.get(where.userId) || null,
      ),
      save: jest.fn(async (row: Record<string, unknown>) => {
        const userId = String(row.userId);
        const saved = { ...row, userId };
        store.set(userId, saved);
        return saved;
      }),
    };
    const memberRepo = { find: jest.fn() };
    const userRepo = {
      findOne: jest.fn(async ({ where }: { where: { id: string } }) =>
        where.id ? { id: where.id } : null,
      ),
      find: jest.fn(async () => [{ id: 'u1' }, { id: 'u2' }]),
    };
    const access = { assertCanRead: jest.fn() };
    const config = {
      get: jest.fn((key: string) =>
        key === 'JWT_SECRET' ? 'test-secret' : undefined,
      ),
    };
    const service = new UserCryptoService(
      cryptoRepo as never,
      memberRepo as never,
      userRepo as never,
      access as never,
      config as unknown as ConfigService,
    );
    return { service, store, cryptoRepo };
  }

  it('provisions server-hold identity when missing', async () => {
    const { service, store } = build();
    const row = await service.ensureIdentity('u1');
    expect(row.userId).toBe('u1');
    expect(row.kdf).toBe(E2EE_KDF_SERVER_HOLD);
    expect(row.publicKey).toBeTruthy();
    expect(store.has('u1')).toBe(true);
  });

  it('activates server-hold into password wrap', async () => {
    const { service } = build();
    await service.ensureIdentity('u1');
    const activated = await service.activateWithPassword('u1', 'SecretPass1');
    expect(activated.kdf).toBe(E2EE_KDF);
    expect(activated.kdfIterations).toBe(310000);
    const again = await service.activateWithPassword('u1', 'SecretPass1');
    expect(again.publicKey).toBe(activated.publicKey);
  });

  it('getPublic auto-ensures missing users', async () => {
    const { service } = build();
    const pub = await service.getPublic('u2');
    expect(pub.userId).toBe('u2');
    expect(pub.publicKey).toBeTruthy();
  });

  it('password rewrap keeps public key and keyVersion', async () => {
    const { service, store } = build();
    store.set('u1', {
      userId: 'u1',
      publicKey: 'pk1',
      wrappedPrivateKey: 'old-wrap',
      wrapSalt: 's',
      wrapIv: 'i',
      algorithm: E2EE_ALGORITHM,
      kdf: E2EE_KDF,
      kdfIterations: 310000,
      keyVersion: 3,
    });
    const saved = await service.upsertMine('u1', {
      publicKey: 'pk1',
      wrappedPrivateKey: 'new-wrap',
      wrapSalt: 's2',
      wrapIv: 'i2',
      kdf: E2EE_KDF,
      kdfIterations: 310000,
    });
    expect(saved.publicKey).toBe('pk1');
    expect(saved.keyVersion).toBe(3);
    expect(saved.wrappedPrivateKey).toBe('new-wrap');
  });

  it('rejects replacing a claimed identity public key', async () => {
    const { service, store } = build();
    store.set('u1', {
      userId: 'u1',
      publicKey: 'pk1',
      wrappedPrivateKey: 'old-wrap',
      wrapSalt: 's',
      wrapIv: 'i',
      algorithm: E2EE_ALGORITHM,
      kdf: E2EE_KDF,
      kdfIterations: 310000,
      keyVersion: 1,
    });
    await expect(
      service.upsertMine('u1', {
        publicKey: 'other-pk',
        wrappedPrivateKey: 'x',
        wrapSalt: 's',
        wrapIv: 'i',
        kdf: E2EE_KDF,
        kdfIterations: 310000,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
