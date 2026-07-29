import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatMessageType } from '../enums/chat.enums';
import { ChatEntity } from './chat.entity';
import { ChatAttachmentEntity } from './chat-attachment.entity';

@Entity('chat_messages')
export class ChatMessageEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_CHAT_MESSAGES_CHAT_CREATED')
  @Column({ name: 'chat_id', type: 'uuid' })
  chatId: string;

  @ManyToOne(() => ChatEntity, (c) => c.messages, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat?: ChatEntity;

  @Column({ name: 'sender_user_id', type: 'uuid', nullable: true })
  senderUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sender_user_id' })
  senderUser?: UserEntity | null;

  @Column({ type: 'varchar', length: 32, default: ChatMessageType.Text })
  type: ChatMessageType;

  @Column({ type: 'text', nullable: true })
  body: string | null;

  @Column({ name: 'reply_to_message_id', type: 'uuid', nullable: true })
  replyToMessageId: string | null;

  @ManyToOne(() => ChatMessageEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reply_to_message_id' })
  replyToMessage?: ChatMessageEntity | null;

  @Column({ name: 'ref_entity_type', type: 'varchar', length: 32, nullable: true })
  refEntityType: string | null;

  @Column({ name: 'ref_entity_id', type: 'uuid', nullable: true })
  refEntityId: string | null;

  @Column({ name: 'edited_at', type: 'timestamptz', nullable: true })
  editedAt: Date | null;

  @Column({ name: 'deleted_at', type: 'timestamptz', nullable: true })
  deletedAt: Date | null;

  @OneToMany(() => ChatAttachmentEntity, (a) => a.message)
  attachments?: ChatAttachmentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
