import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { EvaluationType, ResultStatus } from '../enums';
import { AssessmentAttemptEntity } from './assessment-attempt.entity';
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentResultBreakdownEntity } from './assessment-result-breakdown.entity';

@Entity('assessment_results')
export class AssessmentResultEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_ASSESSMENT_RESULTS_ATTEMPT_ID', { unique: true })
  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @OneToOne(() => AssessmentAttemptEntity, (a) => a.result, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: AssessmentAttemptEntity;

  @Index('IDX_ASSESSMENT_RESULTS_EXAM_ID')
  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => AssessmentExamEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity;

  @Index('IDX_ASSESSMENT_RESULTS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ResultStatus.Processing })
  status: ResultStatus;

  @Column({ name: 'evaluation_type', type: 'varchar', length: 16 })
  evaluationType: EvaluationType;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  score: string;

  @Column({ name: 'max_score', type: 'numeric', precision: 10, scale: 2, default: 0 })
  maxScore: string;

  @Column({ type: 'numeric', precision: 6, scale: 2, default: 0 })
  percent: string;

  @Column({ type: 'boolean', default: false })
  passed: boolean;

  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt: Date | null;

  @Column({ name: 'finished_at', type: 'timestamptz', nullable: true })
  finishedAt: Date | null;

  /** Duration in seconds. */
  @Column({ type: 'int', nullable: true })
  duration: number | null;

  @Column({ name: 'attempt_number', type: 'int' })
  attemptNumber: number;

  @OneToMany(() => AssessmentResultBreakdownEntity, (b) => b.result)
  breakdowns?: AssessmentResultBreakdownEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
