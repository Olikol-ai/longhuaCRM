import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatMemberRole } from '../enums/chat.enums';
import { ChatEntity } from './chat.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Entity('chat_members')
@Unique(['chatId', 'userId'])
export class ChatMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'chat_id', type: 'uuid' })
  chatId: string;

  @ManyToOne(() => ChatEntity, (c) => c.members, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat?: ChatEntity;

  @Index('IDX_CHAT_MEMBERS_USER')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ type: 'varchar', length: 32, default: ChatMemberRole.Member })
  role: ChatMemberRole;

  @CreateDateColumn({ name: 'joined_at', type: 'timestamptz' })
  joinedAt: Date;

  @Column({ name: 'last_read_message_id', type: 'uuid', nullable: true })
  lastReadMessageId: string | null;

  @ManyToOne(() => ChatMessageEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'last_read_message_id' })
  lastReadMessage?: ChatMessageEntity | null;

  /** Wall-clock cursor; kept in sync with last_read_message_id (survives message deletes). */
  @Column({ name: 'last_read_at', type: 'timestamptz', nullable: true })
  lastReadAt: Date | null;

  @Column({ name: 'muted_until', type: 'timestamptz', nullable: true })
  mutedUntil: Date | null;

  /** Personal hide: chat disappears from actor list until new message or reopen. */
  @Column({ name: 'hidden_at', type: 'timestamptz', nullable: true })
  hiddenAt: Date | null;
}
