import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ChatAttachmentKind } from '../enums/chat.enums';
import { ChatMessageEntity } from './chat-message.entity';
import { ChatVoiceMessageEntity } from './chat-voice-message.entity';

@Entity('chat_attachments')
export class ChatAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_CHAT_ATTACHMENTS_MESSAGE')
  @Column({ name: 'message_id', type: 'uuid' })
  messageId: string;

  @ManyToOne(() => ChatMessageEntity, (m) => m.attachments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'message_id' })
  message?: ChatMessageEntity;

  @Column({ type: 'varchar', length: 32 })
  kind: ChatAttachmentKind;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mime: string | null;

  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename: string | null;

  @Column({ name: 'size_bytes', type: 'bigint', nullable: true })
  sizeBytes: string | null;

  @Column({ name: 'duration_ms', type: 'int', nullable: true })
  durationMs: number | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToOne(() => ChatVoiceMessageEntity, (v) => v.attachment)
  voice?: ChatVoiceMessageEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
