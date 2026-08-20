import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { x25519 } from '@noble/curves/ed25519';
import {
  createCipheriv,
  createDecipheriv,
  createHmac,
  pbkdf2Sync,
  randomBytes,
} from 'crypto';
import { Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import { UserEntity } from '../../users/entities/user.entity';
import {
  ChatMemberEntity,
  UserCryptoEntity,
} from '../entities';
import { ChatKind } from '../enums/chat.enums';

export const E2EE_ALGORITHM = 'x25519-aes256gcm-v1';
export const E2EE_KDF = 'pbkdf2-sha256';
export const E2EE_KDF_SERVER_HOLD = 'server-hold-v1';
export const E2EE_DEFAULT_ITERATIONS = 310000;

export type UpsertUserCryptoInput = {
  publicKey: string;
  wrappedPrivateKey: string;
  wrapSalt: string;
  wrapIv: string;
  algorithm?: string;
  kdf?: string;
  kdfIterations?: number;
  keyVersion?: number;
};

export type PublicCryptoView = {
  userId: string;
  publicKey: string;
  algorithm: string;
  keyVersion: number;
};

@Injectable()
export class UserCryptoService implements OnModuleInit {
  private readonly logger = new Logger(UserCryptoService.name);

  constructor(
    @InjectRepository(UserCryptoEntity)
    private readonly cryptoRepo: Repository<UserCryptoEntity>,
    @InjectRepository(ChatMemberEntity)
    private readonly memberRepo: Repository<ChatMemberEntity>,
    @InjectRepository(UserEntity)
    private readonly userRepo: Repository<UserEntity>,
    private readonly access: ChatAccessService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      const created = await this.ensureAllUsers();
      if (created > 0) {
        this.logger.log(`Provisioned E2EE identities for ${created} user(s)`);
      }
    } catch (err) {
      this.logger.warn(`E2EE identity bootstrap failed: ${String(err)}`);
    }
  }

  async getMine(userId: string): Promise<UserCryptoEntity | null> {
    return this.cryptoRepo.findOne({ where: { userId } });
  }

  /**
   * Ensure the user has a public identity. Creates a temporary server-held
   * private key when missing so peers can encrypt before the owner logs in.
   */
  async ensureIdentity(userId: string): Promise<UserCryptoEntity> {
    const existing = await this.getMine(userId);
    if (existing) return existing;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');
    return this.createServerHoldIdentity(userId);
  }

  async ensureAllUsers(): Promise<number> {
    const users = await this.userRepo.find({ select: { id: true } });
    let created = 0;
    for (const user of users) {
      const existing = await this.getMine(user.id);
      if (existing) continue;
      await this.createServerHoldIdentity(user.id);
      created += 1;
    }
    return created;
  }

  async upsertMine(
    userId: string,
    input: UpsertUserCryptoInput,
  ): Promise<UserCryptoEntity> {
    this.assertBase64(input.publicKey, 'publicKey');
    this.assertBase64(input.wrappedPrivateKey, 'wrappedPrivateKey');
    this.assertBase64(input.wrapSalt, 'wrapSalt');
    this.assertBase64(input.wrapIv, 'wrapIv');

    const algorithm = input.algorithm || E2EE_ALGORITHM;
    const kdf = input.kdf || E2EE_KDF;
    if (kdf === E2EE_KDF_SERVER_HOLD) {
      throw new BadRequestException('Client cannot upload server-hold material');
    }
    const kdfIterations = input.kdfIterations ?? E2EE_DEFAULT_ITERATIONS;
    if (kdfIterations < 100000) {
      throw new BadRequestException('kdfIterations must be at least 100000');
    }

    const existing = await this.cryptoRepo.findOne({ where: { userId } });
    if (existing) {
      // Never replace a claimed identity with a fresh keypair silently —
      // activation / rotation must keep decryptability explicit.
      if (existing.kdf === E2EE_KDF_SERVER_HOLD) {
        throw new BadRequestException(
          'Activate server-provisioned keys via POST /crypto/me/activate before replacing them',
        );
      }
      if (existing.publicKey !== input.publicKey) {
        throw new BadRequestException('Cannot replace an existing E2EE identity key');
      }
      existing.wrappedPrivateKey = input.wrappedPrivateKey;
      existing.wrapSalt = input.wrapSalt;
      existing.wrapIv = input.wrapIv;
      existing.algorithm = algorithm;
      existing.kdf = kdf;
      existing.kdfIterations = kdfIterations;
      if (input.keyVersion != null) existing.keyVersion = input.keyVersion;
      return this.cryptoRepo.save(existing);
    }

    return this.cryptoRepo.save({
      userId,
      publicKey: input.publicKey,
      wrappedPrivateKey: input.wrappedPrivateKey,
      wrapSalt: input.wrapSalt,
      wrapIv: input.wrapIv,
      algorithm,
      kdf,
      kdfIterations,
      keyVersion: input.keyVersion ?? 1,
    });
  }

  /**
   * Re-wrap a server-held private key with the user's password (same scheme as the client).
   */
  async activateWithPassword(
    userId: string,
    password: string,
  ): Promise<UserCryptoEntity> {
    const trimmed = password?.trim();
    if (!trimmed || trimmed.length < 6) {
      throw new BadRequestException('password is required');
    }
    const row = await this.ensureIdentity(userId);
    if (row.kdf !== E2EE_KDF_SERVER_HOLD) {
      return row;
    }

    const privateKey = this.unwrapServerHold(userId, row);
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const wrapKey = pbkdf2Sync(
      trimmed,
      salt,
      E2EE_DEFAULT_ITERATIONS,
      32,
      'sha256',
    );
    const cipher = createCipheriv('aes-256-gcm', wrapKey, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(privateKey)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    row.wrappedPrivateKey = Buffer.concat([ciphertext, tag]).toString('base64');
    row.wrapSalt = salt.toString('base64');
    row.wrapIv = iv.toString('base64');
    row.kdf = E2EE_KDF;
    row.kdfIterations = E2EE_DEFAULT_ITERATIONS;
    row.algorithm = E2EE_ALGORITHM;
    return this.cryptoRepo.save(row);
  }

  async getPublic(userId: string): Promise<PublicCryptoView> {
    const row = await this.ensureIdentity(userId);
    return {
      userId: row.userId,
      publicKey: row.publicKey,
      algorithm: row.algorithm,
      keyVersion: row.keyVersion,
    };
  }

  /**
   * Returns public keys for both Direct chat members (no private material).
   * Missing identities are provisioned automatically.
   */
  async getChatE2ee(
    actor: DomainAccessActor,
    chatId: string,
  ): Promise<{
    chatId: string;
    kind: string;
    e2ee: true;
    peers: PublicCryptoView[];
  }> {
    const chat = await this.access.assertCanRead(actor, chatId);
    if (chat.kind !== ChatKind.Direct) {
      throw new BadRequestException('E2EE metadata is only available for Direct chats');
    }
    const members = await this.memberRepo.find({ where: { chatId } });
    const peers: PublicCryptoView[] = [];
    for (const member of members) {
      const row = await this.ensureIdentity(member.userId);
      peers.push({
        userId: row.userId,
        publicKey: row.publicKey,
        algorithm: row.algorithm,
        keyVersion: row.keyVersion,
      });
    }
    return { chatId, kind: chat.kind, e2ee: true, peers };
  }

  private async createServerHoldIdentity(userId: string): Promise<UserCryptoEntity> {
    const privateKey = x25519.utils.randomPrivateKey();
    const publicKey = x25519.getPublicKey(privateKey);
    const hold = this.wrapServerHold(userId, privateKey);
    try {
      return await this.cryptoRepo.save({
        userId,
        publicKey: Buffer.from(publicKey).toString('base64'),
        wrappedPrivateKey: hold.wrappedPrivateKey,
        wrapSalt: hold.wrapSalt,
        wrapIv: hold.wrapIv,
        algorithm: E2EE_ALGORITHM,
        kdf: E2EE_KDF_SERVER_HOLD,
        kdfIterations: 1,
        keyVersion: 1,
      });
    } catch (err) {
      // Concurrent ensure — return the winner.
      const existing = await this.getMine(userId);
      if (existing) return existing;
      throw err;
    }
  }

  private holdSecret(): string {
    return (
      this.config.get<string>('E2EE_SERVER_HOLD_SECRET') ||
      this.config.get<string>('JWT_SECRET') ||
      'longhua-dev-e2ee-hold'
    );
  }

  private deriveHoldKey(userId: string): Buffer {
    return createHmac('sha256', this.holdSecret())
      .update(`longhua-e2ee-hold-v1:${userId}`)
      .digest();
  }

  private wrapServerHold(
    userId: string,
    privateKey: Uint8Array,
  ): { wrappedPrivateKey: string; wrapSalt: string; wrapIv: string } {
    const key = this.deriveHoldKey(userId);
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(Buffer.from(privateKey)),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return {
      wrappedPrivateKey: Buffer.concat([ciphertext, tag]).toString('base64'),
      wrapSalt: createHmac('sha256', this.holdSecret())
        .update(`salt:${userId}`)
        .digest('base64'),
      wrapIv: iv.toString('base64'),
    };
  }

  private unwrapServerHold(userId: string, row: UserCryptoEntity): Uint8Array {
    const key = this.deriveHoldKey(userId);
    const iv = Buffer.from(row.wrapIv, 'base64');
    const blob = Buffer.from(row.wrappedPrivateKey, 'base64');
    if (blob.length < 17) {
      throw new BadRequestException('Corrupt server-hold key material');
    }
    const ciphertext = blob.subarray(0, blob.length - 16);
    const tag = blob.subarray(blob.length - 16);
    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return new Uint8Array(raw);
  }

  private assertBase64(value: string, field: string): void {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`${field} is required`);
    }
    if (value.length > 8192) {
      throw new BadRequestException(`${field} is too long`);
    }
    if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) {
      throw new BadRequestException(`${field} must be base64`);
    }
  }
}
