import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

export type NotificationPreferenceCategory =
  | 'messages'
  | 'lessons'
  | 'homework'
  | 'materials'
  | 'payments'
  | 'certificates'
  | 'exams'
  | 'system';

@Entity('notification_preferences')
@Unique('UQ_NOTIFICATION_PREF_USER_CATEGORY', ['userId', 'category'])
export class NotificationPreferenceEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ type: 'varchar', length: 64 })
  category: NotificationPreferenceCategory;

  @Column({ name: 'push_enabled', type: 'boolean', default: true })
  pushEnabled: boolean;

  @Column({ name: 'in_app_enabled', type: 'boolean', default: true })
  inAppEnabled: boolean;

  @Column({ name: 'telegram_enabled', type: 'boolean', default: true })
  telegramEnabled: boolean;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
