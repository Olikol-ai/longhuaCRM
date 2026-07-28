import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { HomeworkQuestionSnapshotEntity } from './homework-question-snapshot.entity';

@Entity('homework_answer_snapshots')
export class HomeworkAnswerSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ASNAP_QSNAP')
  @Column({ name: 'question_snapshot_id', type: 'uuid' })
  questionSnapshotId: string;

  @ManyToOne(() => HomeworkQuestionSnapshotEntity, (q) => q.answerSnapshots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_snapshot_id' })
  questionSnapshot?: HomeworkQuestionSnapshotEntity;

  @Column({ name: 'source_answer_id', type: 'uuid', nullable: true })
  sourceAnswerId: string | null;

  @Column({ type: 'text' })
  body: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
