import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentQuestionEntity } from './assessment-question.entity';
import { AssessmentContentTaskEntity } from './assessment-content-task.entity';

@Entity('assessment_content_task_questions')
export class AssessmentContentTaskQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_CONTENT_TASK_QUESTIONS_TASK')
  @Column({ name: 'content_task_id', type: 'uuid' })
  contentTaskId: string;

  @ManyToOne(() => AssessmentContentTaskEntity, (t) => t.questions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'content_task_id' })
  task?: AssessmentContentTaskEntity;

  @Index('IDX_CONTENT_TASK_QUESTIONS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => AssessmentQuestionEntity, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
