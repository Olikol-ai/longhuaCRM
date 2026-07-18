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
import { AssessmentResultEntity } from './assessment-result.entity';

@Entity('assessment_result_breakdowns')
@Index('UQ_ASSESSMENT_RESULT_BREAKDOWNS', ['resultId', 'sectionKey'], { unique: true })
export class AssessmentResultBreakdownEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_RESULT_BREAKDOWNS_RESULT')
  @Column({ name: 'result_id', type: 'uuid' })
  resultId: string;

  @ManyToOne(() => AssessmentResultEntity, (r) => r.breakdowns, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'result_id' })
  result?: AssessmentResultEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  weight: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  score: string;

  @Column({ name: 'max_score', type: 'numeric', precision: 10, scale: 2, default: 0 })
  maxScore: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
