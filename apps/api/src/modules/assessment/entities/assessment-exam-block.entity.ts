import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentExamBlockItemEntity } from './assessment-exam-block-item.entity';

/**
 * First-class ExamBlock: reusable ordered set of questions.
 * Materialized into assessment_sections when composing an Exam.
 */
@Entity('assessment_exam_blocks')
export class AssessmentExamBlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'level_label', type: 'varchar', length: 64, nullable: true })
  levelLabel: string | null;

  @Column({ name: 'duration_minutes', type: 'int', nullable: true })
  durationMinutes: number | null;

  @Index('IDX_ASSESSMENT_EXAM_BLOCKS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Index('IDX_ASSESSMENT_EXAM_BLOCKS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentExamBlockItemEntity, (item) => item.block)
  items?: AssessmentExamBlockItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
