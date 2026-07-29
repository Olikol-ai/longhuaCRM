import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus } from '../enums';
import { AssessmentContentTaskQuestionEntity } from './assessment-content-task-question.entity';

export type ContentTaskType = 'listening' | 'reading';

/**
 * Listening / Reading container with nested atomic questions.
 * Authoring lives under «Вопросы»; ExamBlock is no longer the product container.
 */
@Entity('assessment_content_tasks')
export class AssessmentContentTaskEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'task_type', type: 'varchar', length: 32 })
  taskType: ContentTaskType;

  @Column({ type: 'text' })
  title: string;

  /** Reading passage (reading tasks). */
  @Column({ name: 'text_content', type: 'text', nullable: true })
  textContent: string | null;

  /** Secure-files attachment id for listening audio. */
  @Column({ name: 'audio_attachment_id', type: 'uuid', nullable: true })
  audioAttachmentId: string | null;

  @Index('IDX_ASSESSMENT_CONTENT_TASKS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  @Index('IDX_ASSESSMENT_CONTENT_TASKS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentContentTaskQuestionEntity, (q) => q.task)
  questions?: AssessmentContentTaskQuestionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
