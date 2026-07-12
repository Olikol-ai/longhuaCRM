import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';

export const PENDING_REGISTRATION_STATUSES = ['pending', 'blocked'] as const;
export type PendingRegistrationStatus = (typeof PENDING_REGISTRATION_STATUSES)[number];

@Entity('pending_registrations')
export class PendingRegistrationEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  email: string;

  @Column({ name: 'password_hash' })
  passwordHash: string;

  @Column({ name: 'first_name', default: '' })
  firstName: string;

  @Column({ name: 'last_name', default: '' })
  lastName: string;

  @Column({ default: '' })
  phone: string;

  @Column({ name: 'verification_code_hash', type: 'text', nullable: true })
  verificationCodeHash: string | null;

  @Column({ name: 'code_expires_at', type: 'timestamptz', nullable: true })
  codeExpiresAt: Date | null;

  @Column({ name: 'last_sent_at', type: 'timestamptz', nullable: true })
  lastSentAt: Date | null;

  @Column({ name: 'send_count', type: 'int', default: 0 })
  sendCount: number;

  @Column({ name: 'verification_attempts', type: 'int', default: 0 })
  verificationAttempts: number;

  @Column({ default: 'pending' })
  status: PendingRegistrationStatus;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
