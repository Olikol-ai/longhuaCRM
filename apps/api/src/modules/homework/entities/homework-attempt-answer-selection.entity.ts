import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HomeworkAttemptAnswerEntity } from './homework-attempt-answer.entity';
import { HomeworkAnswerSnapshotEntity } from './homework-answer-snapshot.entity';

@Entity('homework_attempt_answer_selections')
export class HomeworkAttemptAnswerSelectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ANS_SEL_ANSWER')
  @Column({ name: 'attempt_answer_id', type: 'uuid' })
  attemptAnswerId: string;

  @ManyToOne(() => HomeworkAttemptAnswerEntity, (a) => a.selections, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_answer_id' })
  attemptAnswer?: HomeworkAttemptAnswerEntity;

  @Column({ name: 'answer_snapshot_id', type: 'uuid' })
  answerSnapshotId: string;

  @ManyToOne(() => HomeworkAnswerSnapshotEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'answer_snapshot_id' })
  answerSnapshot?: HomeworkAnswerSnapshotEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
