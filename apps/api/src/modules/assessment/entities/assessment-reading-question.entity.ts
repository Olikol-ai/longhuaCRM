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
import { ContentLifecycleStatus, QuestionType } from '../enums';
import { AssessmentReadingTaskEntity } from './assessment-reading-task.entity';
import { AssessmentReadingQuestionAnswerEntity } from './assessment-reading-question-answer.entity';

@Entity('assessment_reading_questions')
export class AssessmentReadingQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_READING_QUESTIONS_TASK')
  @Column({ name: 'reading_task_id', type: 'uuid' })
  readingTaskId: string;

  @ManyToOne(() => AssessmentReadingTaskEntity, (t) => t.questions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reading_task_id' })
  task?: AssessmentReadingTaskEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 32 })
  type: QuestionType;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  points: string;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @OneToMany(() => AssessmentReadingQuestionAnswerEntity, (a) => a.question)
  answers?: AssessmentReadingQuestionAnswerEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
