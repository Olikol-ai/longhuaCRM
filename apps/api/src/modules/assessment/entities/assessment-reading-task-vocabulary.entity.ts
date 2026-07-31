import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { AssessmentReadingTaskEntity } from './assessment-reading-task.entity';

@Entity('assessment_reading_task_vocabulary')
export class AssessmentReadingTaskVocabularyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_READING_TASK_VOCAB_TASK')
  @Column({ name: 'reading_task_id', type: 'uuid' })
  readingTaskId: string;

  @ManyToOne(() => AssessmentReadingTaskEntity, (t) => t.vocabulary, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reading_task_id' })
  task?: AssessmentReadingTaskEntity;

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

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
