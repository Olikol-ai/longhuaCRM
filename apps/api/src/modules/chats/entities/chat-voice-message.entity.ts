import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn } from 'typeorm';
import { ChatAttachmentEntity } from './chat-attachment.entity';

@Entity('chat_voice_messages')
export class ChatVoiceMessageEntity {
  @PrimaryColumn({ name: 'attachment_id', type: 'uuid' })
  attachmentId: string;

  @OneToOne(() => ChatAttachmentEntity, (a) => a.voice, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attachment_id' })
  attachment?: ChatAttachmentEntity;

  @Column({ name: 'duration_ms', type: 'int', default: 0 })
  durationMs: number;
}
