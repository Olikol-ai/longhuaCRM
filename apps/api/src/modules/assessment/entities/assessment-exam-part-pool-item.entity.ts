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
import { AssessmentExamPartEntity } from './assessment-exam-part.entity';
import { AssessmentReadingTaskEntity } from './assessment-reading-task.entity';
import { AssessmentListeningTaskEntity } from './assessment-listening-task.entity';

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

  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  questionId: string | null;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity | null;

  @Column({ name: 'reading_task_id', type: 'uuid', nullable: true })
  readingTaskId: string | null;

  @ManyToOne(() => AssessmentReadingTaskEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'reading_task_id' })
  readingTask?: AssessmentReadingTaskEntity | null;

  @Column({ name: 'listening_task_id', type: 'uuid', nullable: true })
  listeningTaskId: string | null;

  @ManyToOne(() => AssessmentListeningTaskEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'listening_task_id' })
  listeningTask?: AssessmentListeningTaskEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
