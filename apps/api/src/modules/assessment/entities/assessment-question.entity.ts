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
import { AssessmentBankEntity } from './assessment-bank.entity';
import { AssessmentAnswerEntity } from './assessment-answer.entity';
import { AssessmentQuestionAttachmentEntity } from './assessment-question-attachment.entity';

@Entity('assessment_questions')
export class AssessmentQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_QUESTIONS_BANK_ID')
  @Column({ name: 'bank_id', type: 'uuid' })
  bankId: string;

  @ManyToOne(() => AssessmentBankEntity, (bank) => bank.questions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'bank_id' })
  bank?: AssessmentBankEntity;

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
