import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { QuestionType } from '../../assessment/enums';
import { HomeworkAttemptEntity } from './homework-attempt.entity';
import { HomeworkAnswerSnapshotEntity } from './homework-answer-snapshot.entity';

@Entity('homework_question_snapshots')
export class HomeworkQuestionSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_QSNAP_ATTEMPT')
  @Column({ name: 'attempt_id', type: 'uuid' })
  attemptId: string;

  @ManyToOne(() => HomeworkAttemptEntity, (a) => a.questionSnapshots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'attempt_id' })
  attempt?: HomeworkAttemptEntity;

  @Column({ name: 'source_question_id', type: 'uuid', nullable: true })
  sourceQuestionId: string | null;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ type: 'varchar', length: 32 })
  type: QuestionType;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  points: string;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passageText: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => HomeworkAnswerSnapshotEntity, (a) => a.questionSnapshot)
  answerSnapshots?: HomeworkAnswerSnapshotEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
