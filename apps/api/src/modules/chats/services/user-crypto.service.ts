import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { ChatAccessService } from '../../../common/access/chat-access.service';
import { DomainAccessActor } from '../../../common/access/domain-access.types';
import {
  ChatEntity,
  ChatMemberEntity,
  UserCryptoEntity,
} from '../entities';
import { ChatKind } from '../enums/chat.enums';

export const E2EE_ALGORITHM = 'x25519-aes256gcm-v1';
export const E2EE_KDF = 'pbkdf2-sha256';
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

@Injectable()
export class UserCryptoService {
  constructor(
    @InjectRepository(UserCryptoEntity)
    private readonly cryptoRepo: Repository<UserCryptoEntity>,
    @InjectRepository(ChatEntity)
    private readonly chatRepo: Repository<ChatEntity>,
    @InjectRepository(ChatMemberEntity)
    private readonly memberRepo: Repository<ChatMemberEntity>,
    private readonly access: ChatAccessService,
  ) {}

  async getMine(userId: string): Promise<UserCryptoEntity | null> {
    return this.cryptoRepo.findOne({ where: { userId } });
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
    const kdfIterations = input.kdfIterations ?? E2EE_DEFAULT_ITERATIONS;
    if (kdfIterations < 100000) {
      throw new BadRequestException('kdfIterations must be at least 100000');
    }

    const existing = await this.cryptoRepo.findOne({ where: { userId } });
    if (existing) {
      existing.publicKey = input.publicKey;
      existing.wrappedPrivateKey = input.wrappedPrivateKey;
      existing.wrapSalt = input.wrapSalt;
      existing.wrapIv = input.wrapIv;
      existing.algorithm = algorithm;
      existing.kdf = kdf;
      existing.kdfIterations = kdfIterations;
      if (input.keyVersion != null) existing.keyVersion = input.keyVersion;
      else existing.keyVersion = (existing.keyVersion || 1) + 1;
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

  async getPublic(userId: string): Promise<{
    userId: string;
    publicKey: string;
    algorithm: string;
    keyVersion: number;
  }> {
    const row = await this.cryptoRepo.findOne({ where: { userId } });
    if (!row) throw new NotFoundException('Public key not found for user');
    return {
      userId: row.userId,
      publicKey: row.publicKey,
      algorithm: row.algorithm,
      keyVersion: row.keyVersion,
    };
  }

  /**
   * Returns public keys for both Direct chat members (no private material).
   */
  async getChatE2ee(
    actor: DomainAccessActor,
    chatId: string,
  ): Promise<{
    chatId: string;
    kind: string;
    e2ee: true;
    peers: Array<{
      userId: string;
      publicKey: string;
      algorithm: string;
      keyVersion: number;
    }>;
  }> {
    const chat = await this.access.assertCanRead(actor, chatId);
    if (chat.kind !== ChatKind.Direct) {
      throw new BadRequestException('E2EE metadata is only available for Direct chats');
    }
    const members = await this.memberRepo.find({ where: { chatId } });
    const userIds = members.map((m) => m.userId);
    const keys = await this.cryptoRepo.find({
      where: { userId: In(userIds) },
    });
    const byUser = new Map(keys.map((k) => [k.userId, k]));
    const peers = userIds.map((userId) => {
      const row = byUser.get(userId);
      if (!row) {
        throw new NotFoundException(
          `Участник ${userId} ещё не настроил сквозное шифрование`,
        );
      }
      return {
        userId,
        publicKey: row.publicKey,
        algorithm: row.algorithm,
        keyVersion: row.keyVersion,
      };
    });
    return { chatId, kind: chat.kind, e2ee: true, peers };
  }

  private assertBase64(value: string, field: string): void {
    if (!value || typeof value !== 'string') {
      throw new BadRequestException(`${field} is required`);
    }
    if (value.length > 8192) {
      throw new BadRequestException(`${field} is too long`);
    }
    // Loose check — client sends standard base64.
    if (!/^[A-Za-z0-9+/=_-]+$/.test(value)) {
      throw new BadRequestException(`${field} must be base64`);
    }
  }
}
