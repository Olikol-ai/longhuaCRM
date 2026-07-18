import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentAttemptAnswerEntity } from './assessment-attempt-answer.entity';
import { AssessmentAnswerSnapshotEntity } from './assessment-answer-snapshot.entity';

/**
 * Normalized selected options for single/multiple choice (and listening MC).
 * One row per selected AnswerSnapshot — not uuid[].
 */
@Entity('assessment_attempt_answer_selections')
@Index('UQ_ASSESSMENT_ATTEMPT_ANSWER_SEL', ['attemptAnswerId', 'answerSnapshotId'], {
  unique: true,
})
export class AssessmentAttemptAnswerSelectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_ATTEMPT_ANSWER_SEL_AA')
  @Column({ name: 'attempt_answer_id', type: 'uuid' })
  attemptAnswerId: string;

  @ManyToOne(() => AssessmentAttemptAnswerEntity, (a) => a.selections, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_answer_id' })
  attemptAnswer?: AssessmentAttemptAnswerEntity;

  @Index('IDX_ASSESSMENT_ATTEMPT_ANSWER_SEL_AS')
  @Column({ name: 'answer_snapshot_id', type: 'uuid' })
  answerSnapshotId: string;

  @ManyToOne(() => AssessmentAnswerSnapshotEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'answer_snapshot_id' })
  answerSnapshot?: AssessmentAnswerSnapshotEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
