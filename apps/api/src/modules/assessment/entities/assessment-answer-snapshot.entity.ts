import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentQuestionSnapshotEntity } from './assessment-question-snapshot.entity';

@Entity('assessment_answer_snapshots')
export class AssessmentAnswerSnapshotEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_ANSWER_SNAPSHOTS_Q')
  @Column({ name: 'question_snapshot_id', type: 'uuid' })
  questionSnapshotId: string;

  @ManyToOne(() => AssessmentQuestionSnapshotEntity, (q) => q.answerSnapshots, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_snapshot_id' })
  questionSnapshot?: AssessmentQuestionSnapshotEntity;

  @Column({ name: 'source_answer_id', type: 'uuid', nullable: true })
  sourceAnswerId: string | null;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
