import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatEntity } from './chat.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Entity('chat_pinned_messages')
@Unique(['chatId', 'messageId'])
export class ChatPinnedMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chat_id', type: 'uuid' })
  chatId: string;

  @ManyToOne(() => ChatEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat?: ChatEntity;

  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @ManyToOne(() => ChatMessageEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: ChatMessageEntity;

  @Column({ name: 'pinned_by_user_id', type: 'uuid', nullable: true })
  pinnedByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'pinned_by_user_id' })
  pinnedByUser?: UserEntity | null;

  @CreateDateColumn({ name: 'pinned_at', type: 'timestamptz' })
  pinnedAt: Date;
}
