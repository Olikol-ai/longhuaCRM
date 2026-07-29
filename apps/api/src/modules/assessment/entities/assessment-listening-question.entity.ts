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
import { AssessmentListeningTaskEntity } from './assessment-listening-task.entity';
import { AssessmentListeningQuestionAnswerEntity } from './assessment-listening-question-answer.entity';

@Entity('assessment_listening_questions')
export class AssessmentListeningQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_LISTENING_QUESTIONS_TASK')
  @Column({ name: 'listening_task_id', type: 'uuid' })
  listeningTaskId: string;

  @ManyToOne(() => AssessmentListeningTaskEntity, (t) => t.questions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listening_task_id' })
  task?: AssessmentListeningTaskEntity;

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

  @OneToMany(() => AssessmentListeningQuestionAnswerEntity, (a) => a.question)
  answers?: AssessmentListeningQuestionAnswerEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
