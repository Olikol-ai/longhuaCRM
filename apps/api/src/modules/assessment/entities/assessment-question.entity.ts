import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ContentLifecycleStatus, QuestionType } from '../enums';
import { AssessmentAnswerEntity } from './assessment-answer.entity';
import { AssessmentQuestionAttachmentEntity } from './assessment-question-attachment.entity';

@Entity('assessment_questions')
export class AssessmentQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 32 })
  type: QuestionType;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 1 })
  points: string;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Index('IDX_ASSESSMENT_QUESTIONS_STATUS')
  @Column({ type: 'varchar', length: 32, default: ContentLifecycleStatus.Draft })
  status: ContentLifecycleStatus;

  /** Owner: teacher / tutor / admin user id. */
  @Index('IDX_ASSESSMENT_QUESTIONS_CREATED_BY')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @OneToMany(() => AssessmentAnswerEntity, (a) => a.question)
  answers?: AssessmentAnswerEntity[];

  @OneToMany(() => AssessmentQuestionAttachmentEntity, (a) => a.question)
  attachments?: AssessmentQuestionAttachmentEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
