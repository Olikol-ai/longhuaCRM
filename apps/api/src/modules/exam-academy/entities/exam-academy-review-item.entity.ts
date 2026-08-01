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
import { ExamAcademyContentItemEntity } from './exam-academy-content-item.entity';

@Entity('exam_academy_review_items')
@Index('UQ_EA_REVIEW_USER_CONTENT', ['userId', 'contentKind', 'contentId'], { unique: true })
export class ExamAcademyReviewItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_REVIEW_USER_STATUS')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'content_kind', type: 'varchar', length: 32 })
  contentKind: string;

  @Column({ name: 'content_id', type: 'uuid' })
  contentId: string;

  @Column({ name: 'content_item_id', type: 'uuid', nullable: true })
  contentItemId: string | null;

  @ManyToOne(() => ExamAcademyContentItemEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'content_item_id' })
  contentItem?: ExamAcademyContentItemEntity | null;

  @Column({ name: 'source_attempt_id', type: 'uuid', nullable: true })
  sourceAttemptId: string | null;

  @Column({ name: 'wrong_count', type: 'int', default: 1 })
  wrongCount: number;

  @Column({ name: 'last_wrong_at', type: 'timestamptz' })
  lastWrongAt: Date;

  @Column({ name: 'next_review_at', type: 'timestamptz', nullable: true })
  nextReviewAt: Date | null;

  @Column({ name: 'mastered_at', type: 'timestamptz', nullable: true })
  masteredAt: Date | null;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
