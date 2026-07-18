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
import { AttachmentKind } from '../enums';
import { AssessmentQuestionEntity } from './assessment-question.entity';

@Entity('assessment_question_attachments')
export class AssessmentQuestionAttachmentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_QUESTION_ATTACHMENTS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => AssessmentQuestionEntity, (q) => q.attachments, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity;

  @Column({ type: 'varchar', length: 32 })
  kind: AttachmentKind;

  @Column({ name: 'storage_key', type: 'text' })
  storageKey: string;

  @Column({ type: 'varchar', length: 128, nullable: true })
  mime: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
