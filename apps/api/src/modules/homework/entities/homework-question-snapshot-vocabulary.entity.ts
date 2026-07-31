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

@Entity('homework_question_snapshot_vocabulary')
export class HomeworkQuestionSnapshotVocabularyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_QSNAP_VOCAB_SNAP')
  @Column({ name: 'question_snapshot_id', type: 'uuid' })
  questionSnapshotId: string;

  @ManyToOne(() => HomeworkQuestionSnapshotEntity, (q) => q.vocabulary, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_snapshot_id' })
  questionSnapshot?: HomeworkQuestionSnapshotEntity;

  @Column({ type: 'text' })
  word: string;

  @Column({ type: 'text', nullable: true })
  pinyin: string | null;

  @Column({ type: 'text', nullable: true })
  translation: string | null;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
