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
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentExamPartPoolItemEntity } from './assessment-exam-part-pool-item.entity';

export type ExamPartKind = 'test' | 'listening' | 'reading';

/**
 * Generation rule for one exam part: pick `selectCount` items from the pool at attempt start.
 */
@Entity('assessment_exam_parts')
export class AssessmentExamPartEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_EXAM_PARTS_EXAM')
  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => AssessmentExamEntity, (e) => e.parts, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'part_kind', type: 'varchar', length: 32 })
  partKind: ExamPartKind;

  @Column({ type: 'text', nullable: true })
  title: string | null;

  @Column({ name: 'select_count', type: 'int', default: 1 })
  selectCount: number;

  @OneToMany(() => AssessmentExamPartPoolItemEntity, (i) => i.part)
  poolItems?: AssessmentExamPartPoolItemEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
