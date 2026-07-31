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
import { AssessmentListeningTaskEntity } from './assessment-listening-task.entity';

@Entity('assessment_listening_task_vocabulary')
export class AssessmentListeningTaskVocabularyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LISTENING_TASK_VOCAB_TASK')
  @Column({ name: 'listening_task_id', type: 'uuid' })
  listeningTaskId: string;

  @ManyToOne(() => AssessmentListeningTaskEntity, (t) => t.vocabulary, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listening_task_id' })
  task?: AssessmentListeningTaskEntity;

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
