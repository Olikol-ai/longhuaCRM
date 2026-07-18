import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PassingMode, RetakePolicy, ShowCorrectAnswers } from '../enums';
import { AssessmentExamEntity } from './assessment-exam.entity';

/**
 * Single store for exam conduct rules.
 * Primary rule: examId set (1:1 with Exam).
 * Override rule for Assignment: examId null, referenced via assessment_rule_override_id.
 */
@Entity('assessment_rules')
export class AssessmentRuleEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'exam_id', type: 'uuid', nullable: true, unique: true })
  examId: string | null;

  @OneToOne(() => AssessmentExamEntity, (e) => e.rule, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity | null;

  @Column({ name: 'duration_minutes', type: 'int' })
  durationMinutes: number;

  @Column({ name: 'max_attempts', type: 'int', default: 1 })
  maxAttempts: number;

  @Column({ name: 'allow_retake', type: 'boolean', default: false })
  allowRetake: boolean;

  @Column({ name: 'retake_policy', type: 'varchar', length: 16, default: RetakePolicy.Last })
  retakePolicy: RetakePolicy;

  @Column({ name: 'allow_review', type: 'boolean', default: false })
  allowReview: boolean;

  @Column({ name: 'show_result_after_submit', type: 'boolean', default: true })
  showResultAfterSubmit: boolean;

  @Column({
    name: 'show_correct_answers',
    type: 'varchar',
    length: 32,
    default: ShowCorrectAnswers.Never,
  })
  showCorrectAnswers: ShowCorrectAnswers;

  /** Always true by invariant — timeout always auto-submits. */
  @Column({ name: 'auto_submit_on_timeout', type: 'boolean', default: true })
  autoSubmitOnTimeout: boolean;

  @Column({ name: 'allow_pause', type: 'boolean', default: false })
  allowPause: boolean;

  @Column({ name: 'randomize_questions', type: 'boolean', default: false })
  randomizeQuestions: boolean;

  @Column({ name: 'randomize_answers', type: 'boolean', default: false })
  randomizeAnswers: boolean;

  @Column({ name: 'passing_mode', type: 'varchar', length: 16, default: PassingMode.Percent })
  passingMode: PassingMode;

  @Column({ name: 'pass_score', type: 'numeric', precision: 10, scale: 2, nullable: true })
  passScore: string | null;

  @Column({
    name: 'pass_score_percent',
    type: 'numeric',
    precision: 6,
    scale: 2,
    nullable: true,
  })
  passScorePercent: string | null;

  @Column({ name: 'allow_navigation', type: 'boolean', default: true })
  allowNavigation: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
