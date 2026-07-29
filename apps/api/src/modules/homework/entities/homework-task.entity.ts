import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentQuestionEntity } from '../../assessment/entities/assessment-question.entity';
import { AssessmentContentTaskEntity } from '../../assessment/entities/assessment-content-task.entity';
import { HomeworkEntity } from './homework.entity';

export type HomeworkTaskKind = 'question' | 'listening' | 'reading';

/**
 * Homework composition entry: atomic question or Listening/Reading container.
 * Expanded into attempt snapshots at start (containers → nested questions).
 */
@Entity('homework_tasks')
export class HomeworkTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_TASKS_HOMEWORK')
  @Column({ name: 'homework_id', type: 'uuid' })
  homeworkId: string;

  @ManyToOne(() => HomeworkEntity, (h) => h.tasks, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'homework_id' })
  homework?: HomeworkEntity;

  @Column({ name: 'task_kind', type: 'varchar', length: 32 })
  taskKind: HomeworkTaskKind;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  questionId: string | null;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity | null;

  @Column({ name: 'content_task_id', type: 'uuid', nullable: true })
  contentTaskId: string | null;

  @ManyToOne(() => AssessmentContentTaskEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'content_task_id' })
  contentTask?: AssessmentContentTaskEntity | null;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  points: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
