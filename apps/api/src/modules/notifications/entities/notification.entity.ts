import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export type NotificationChannel = 'telegram' | 'email' | 'in_app' | 'web_push';
export type NotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

@Entity('notifications')
export class NotificationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_NOTIFICATION_USER_ID')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({
    type: 'varchar',
    length: 32,
  })
  channel: NotificationChannel;

  @Column({ type: 'varchar', length: 64 })
  type: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'pending',
  })
  status: NotificationStatus;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @Column({ name: 'sent_at', type: 'timestamptz', nullable: true })
  sentAt: Date | null;

  @Column({ name: 'reference_type', type: 'varchar', length: 64, nullable: true })
  referenceType: string | null;

  @Column({ name: 'reference_id', type: 'varchar', length: 128, nullable: true })
  referenceId: string | null;

  /** Business event id — idempotency with (eventId, userId, channel). */
  @Column({ name: 'event_id', type: 'uuid', nullable: true })
  eventId: string | null;

  @Column({ name: 'deep_link', type: 'varchar', length: 512, nullable: true })
  deepLink: string | null;

  @Column({ name: 'attempt_count', type: 'int', default: 0 })
  attemptCount: number;

  @Column({ name: 'last_error', type: 'text', nullable: true })
  lastError: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
