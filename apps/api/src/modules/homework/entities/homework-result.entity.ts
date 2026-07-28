import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EvaluationType } from '../../assessment/enums';
import { HomeworkAttemptEntity } from './homework-attempt.entity';

@Entity('homework_results')
export class HomeworkResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_RESULTS_ATTEMPT', { unique: true })
  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @OneToOne(() => HomeworkAttemptEntity, (a) => a.result, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: HomeworkAttemptEntity;

  @Index('IDX_HOMEWORK_RESULTS_ASSIGNMENT')
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  score: string;

  @Column({ name: 'max_score', type: 'numeric', precision: 10, scale: 2, default: 0 })
  maxScore: string;

  @Column({ type: 'numeric', precision: 5, scale: 2, default: 0 })
  percent: string;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({ name: 'evaluation_type', type: 'varchar', length: 32 })
  evaluationType: EvaluationType;

  /** processing | pending_review | reviewed */
  @Column({ type: 'varchar', length: 32, default: 'reviewed' })
  status: string;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'breakdown_json', type: 'text', nullable: true })
  breakdownJson: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
