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
import { HomeworkAttemptEntity } from './homework-attempt.entity';
import { HomeworkQuestionSnapshotEntity } from './homework-question-snapshot.entity';
import { HomeworkAttemptAnswerSelectionEntity } from './homework-attempt-answer-selection.entity';

@Entity('homework_attempt_answers')
export class HomeworkAttemptAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ATTEMPT_ANSWERS_ATTEMPT')
  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => HomeworkAttemptEntity, (a) => a.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: HomeworkAttemptEntity;

  @Index('IDX_HOMEWORK_ATTEMPT_ANSWERS_QSNAP')
  @Column({ name: 'question_snapshot_id', type: 'uuid' })
  questionSnapshotId: string;

  @ManyToOne(() => HomeworkQuestionSnapshotEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_snapshot_id' })
  questionSnapshot?: HomeworkQuestionSnapshotEntity;

  @Column({ name: 'text_answer', type: 'text', nullable: true })
  textAnswer: string | null;

  @Column({ name: 'earned_points', type: 'numeric', precision: 10, scale: 2, nullable: true })
  earnedPoints: string | null;

  @Column({ name: 'is_correct', type: 'boolean', nullable: true })
  isCorrect: boolean | null;

  @OneToMany(() => HomeworkAttemptAnswerSelectionEntity, (s) => s.attemptAnswer)
  selections?: HomeworkAttemptAnswerSelectionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
