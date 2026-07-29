import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('users')
export class UserEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ default: '' })
  role: string;

  @Column({ default: 'pending' })
  status: string;

  @Column({ name: 'email_verified', default: false })
  emailVerified: boolean;

  @Column({ name: 'verification_code', type: 'text', nullable: true })
  verificationCode: string | null;

  @Column({ name: 'verification_attempts', type: 'int', default: 0 })
  verificationAttempts: number;

  @Column({ name: 'verification_code_expires_at', type: 'timestamptz', nullable: true })
  verificationCodeExpiresAt: Date | null;

  @Column({ name: 'verification_code_sent_at', type: 'timestamptz', nullable: true })
  verificationCodeSentAt: Date | null;

  @Column({ name: 'first_name', default: '' })
  firstName: string;

  @Column({ name: 'last_name', default: '' })
  lastName: string;

  @Column({ default: '' })
  phone: string;

  @Column({ name: 'telegram_id', default: '' })
  telegramId: string;

  @Column({ name: 'telegram_username', default: '' })
  telegramUsername: string;

  @Column({ name: 'telegram_connected_at', type: 'timestamptz', nullable: true })
  telegramConnectedAt: Date | null;

  @Column({ name: 'telegram_link_token', type: 'text', nullable: true })
  telegramLinkToken: string | null;

  @Column({ name: 'telegram_link_expires', type: 'timestamptz', nullable: true })
  telegramLinkExpires: Date | null;

  @Column({ name: 'password_reset_token', type: 'text', nullable: true })
  passwordResetToken: string | null;

  @Column({ name: 'password_reset_expires_at', type: 'timestamptz', nullable: true })
  passwordResetExpiresAt: Date | null;

  @Column({ name: 'telegram_notify_24h', default: true })
  telegramNotify24h: boolean;

  @Column({ name: 'telegram_notify_3h', default: true })
  telegramNotify3h: boolean;

  @Column({ name: 'avatar_file_path', type: 'text', nullable: true })
  avatarFilePath: string | null;

  @Column({ name: 'avatar_thumb_path', type: 'text', nullable: true })
  avatarThumbPath: string | null;

  @Column({ name: 'avatar_updated_at', type: 'timestamptz', nullable: true })
  avatarUpdatedAt: Date | null;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
