import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

/** Per-user E2EE identity material. Private key is stored only as ciphertext. */
@Entity('user_crypto')
export class UserCryptoEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  /** Base64 raw X25519 public key (32 bytes). */
  @Column({ name: 'public_key', type: 'text' })
  publicKey: string;

  /** Base64 AES-GCM ciphertext of the private key. */
  @Column({ name: 'wrapped_private_key', type: 'text' })
  wrappedPrivateKey: string;

  /** Base64 PBKDF2 salt. */
  @Column({ name: 'wrap_salt', type: 'text' })
  wrapSalt: string;

  /** Base64 AES-GCM IV for wrapped private key. */
  @Column({ name: 'wrap_iv', type: 'text' })
  wrapIv: string;

  @Column({ type: 'varchar', length: 64, default: 'x25519-aes256gcm-v1' })
  algorithm: string;

  @Column({ type: 'varchar', length: 32, default: 'pbkdf2-sha256' })
  kdf: string;

  @Column({ name: 'kdf_iterations', type: 'int', default: 310000 })
  kdfIterations: number;

  @Column({ name: 'key_version', type: 'int', default: 1 })
  keyVersion: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
