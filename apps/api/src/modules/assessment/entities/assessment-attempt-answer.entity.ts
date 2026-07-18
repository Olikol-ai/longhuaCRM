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
import { AssessmentAttemptEntity } from './assessment-attempt.entity';
import { AssessmentQuestionSnapshotEntity } from './assessment-question-snapshot.entity';
import { AssessmentAttemptAnswerSelectionEntity } from './assessment-attempt-answer-selection.entity';

@Entity('assessment_attempt_answers')
@Index('UQ_ASSESSMENT_ATTEMPT_ANSWERS', ['attemptId', 'questionSnapshotId'], { unique: true })
export class AssessmentAttemptAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_ATTEMPT_ANSWERS_ATTEMPT')
  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => AssessmentAttemptEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: AssessmentAttemptEntity;

  @Index('IDX_ASSESSMENT_ATTEMPT_ANSWERS_Q_SNAP')
  @Column({ name: 'question_snapshot_id', type: 'uuid' })
  questionSnapshotId: string;

  @ManyToOne(() => AssessmentQuestionSnapshotEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_snapshot_id' })
  questionSnapshot?: AssessmentQuestionSnapshotEntity;

  @Column({ name: 'text_answer', type: 'text', nullable: true })
  textAnswer: string | null;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect: boolean | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  score: string | null;

  @Column({ name: 'review_comment', type: 'text', nullable: true })
  reviewComment: string | null;

  @Index('IDX_ASSESSMENT_ATTEMPT_ANSWERS_REVIEWED_BY')
  @Column({ name: 'reviewed_by_user_id', type: 'uuid', nullable: true })
  reviewedByUserId: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamptz', nullable: true })
  reviewedAt: Date | null;

  @OneToMany(() => AssessmentAttemptAnswerSelectionEntity, (s) => s.attemptAnswer)
  selections?: AssessmentAttemptAnswerSelectionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
