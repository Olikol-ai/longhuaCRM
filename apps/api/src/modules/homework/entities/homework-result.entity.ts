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
  @Column({ name: 'attempt_id', type: 'uuid', nullable: true })
  attemptId: string | null;

  @OneToOne(() => HomeworkAttemptEntity, (a) => a.result, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: HomeworkAttemptEntity;

  @Index('IDX_HOMEWORK_RESULTS_ASSIGNMENT')
  @Column({ name: 'assignment_id', type: 'uuid' })
  assignmentId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  score: string | null;

  @Column({ name: 'max_score', type: 'numeric', precision: 10, scale: 2, nullable: true })
  maxScore: string | null;

  @Column({ type: 'numeric', precision: 5, scale: 2, nullable: true })
  percent: string | null;

  /** auto = earned/max; manual = teacher-entered percent (not recomputed). */
  @Column({ name: 'grading_mode', type: 'varchar', length: 16, default: 'auto' })
  gradingMode: 'auto' | 'manual';

  @Column({ name: 'manual_percentage', type: 'numeric', precision: 5, scale: 2, nullable: true })
  manualPercentage: string | null;

  /** When true, students may see expected/correct answers after review. */
  @Column({ name: 'show_correct_answers', type: 'boolean', default: false })
  showCorrectAnswers: boolean;

  @Column({ type: 'boolean', nullable: true })
  passed: boolean | null;

  @Column({ name: 'evaluation_type', type: 'varchar', length: 32 })
  evaluationType: EvaluationType;

  /** processing | pending_review | reviewed */
  @Column({ type: 'varchar', length: 32, default: 'reviewed' })
  status: string;

  @Column({ name: 'duration_seconds', type: 'int', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'breakdown_json', type: 'text', nullable: true })
  breakdownJson: string | null;

  // Local (tutor) flow for non-registered students:
  // store completion/review metadata directly in AssignmentResult.
  @Column({ name: 'completed_at', type: 'timestamptz', nullable: true })
  completedAt: Date | null;

  @Column({ name: 'checked_at', type: 'timestamptz', nullable: true })
  checkedAt: Date | null;

  @Column({ name: 'owner_comment', type: 'text', nullable: true })
  ownerComment: string | null;

  @Column({ name: 'review_result', type: 'text', nullable: true })
  reviewResult: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
