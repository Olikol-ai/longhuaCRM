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
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatKind, ChatStatus } from '../enums/chat.enums';
import { SubjectEntity } from './subject.entity';
import { ChatMemberEntity } from './chat-member.entity';
import { ChatMessageEntity } from './chat-message.entity';

@Entity('chats')
export class ChatEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_CHATS_KIND')
  @Column({ type: 'varchar', length: 32 })
  kind: ChatKind;

  @Column({ name: 'subject_id', type: 'uuid', nullable: true })
  subjectId: string | null;

  @ManyToOne(() => SubjectEntity, (s) => s.chats, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'subject_id' })
  subject?: SubjectEntity | null;

  @Column({ name: 'course_template_id', type: 'uuid', nullable: true })
  courseTemplateId: string | null;

  @ManyToOne(() => CourseTemplateEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'course_template_id' })
  courseTemplate?: CourseTemplateEntity | null;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Index('IDX_CHATS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ChatStatus.Active })
  status: ChatStatus;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: UserEntity | null;

  @OneToMany(() => ChatMemberEntity, (m) => m.chat)
  members?: ChatMemberEntity[];

  @OneToMany(() => ChatMessageEntity, (m) => m.chat)
  messages?: ChatMessageEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
