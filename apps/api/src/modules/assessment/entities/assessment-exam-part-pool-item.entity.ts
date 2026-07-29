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
import { AssessmentExamPartEntity } from './assessment-exam-part.entity';

@Entity('assessment_exam_part_pool_items')
export class AssessmentExamPartPoolItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EXAM_PART_POOL_PART')
  @Column({ name: 'part_id', type: 'uuid' })
  partId: string;

  @ManyToOne(() => AssessmentExamPartEntity, (p) => p.poolItems, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'part_id' })
  part?: AssessmentExamPartEntity;

  /** Atomic question for test parts. */
  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  questionId: string | null;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity | null;

  /** Listening/Reading container for listening/reading parts. */
  @Column({ name: 'content_task_id', type: 'uuid', nullable: true })
  contentTaskId: string | null;

  @ManyToOne(() => AssessmentContentTaskEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_task_id' })
  contentTask?: AssessmentContentTaskEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
