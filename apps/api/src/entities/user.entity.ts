import { Column, CreateDateColumn, Entity, Index, PrimaryColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ name: 'verification_code', type: 'text', nullable: true })
  verificationCode: string | null;

  @Column({ name: 'verification_attempts', type: 'int', default: 0 })
  verificationAttempts: number;

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

  @Column({ name: 'telegram_link_token', type: 'text', nullable: true })
  telegramLinkToken: string | null;

  @Column({ name: 'telegram_link_expires', type: 'timestamptz', nullable: true })
  telegramLinkExpires: Date | null;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
