import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { DirectChatRequestStatus } from '../enums/chat.enums';
import { ChatEntity } from './chat.entity';

@Entity('direct_chat_requests')
export class DirectChatRequestEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_DIRECT_CHAT_REQUESTS_FROM_STATUS')
  @Column({ name: 'from_user_id', type: 'uuid' })
  fromUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'from_user_id' })
  fromUser?: UserEntity;

  @Index('IDX_DIRECT_CHAT_REQUESTS_TO_STATUS')
  @Column({ name: 'to_user_id', type: 'uuid' })
  toUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'to_user_id' })
  toUser?: UserEntity;

  @Column({ type: 'varchar', length: 32, default: DirectChatRequestStatus.Pending })
  status: DirectChatRequestStatus;

  @Column({ type: 'text', nullable: true })
  message: string | null;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt: Date | null;

  @Column({ name: 'expires_at', type: 'timestamptz', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'created_chat_id', type: 'uuid', nullable: true })
  createdChatId: string | null;

  @ManyToOne(() => ChatEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_chat_id' })
  createdChat?: ChatEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
