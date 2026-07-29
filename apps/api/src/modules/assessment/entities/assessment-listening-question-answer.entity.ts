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
import { AssessmentListeningQuestionEntity } from './assessment-listening-question.entity';

@Entity('assessment_listening_question_answers')
export class AssessmentListeningQuestionAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LISTENING_QUESTION_ANSWERS_QUESTION')
  @Column({ name: 'listening_question_id', type: 'uuid' })
  listeningQuestionId: string;

  @ManyToOne(() => AssessmentListeningQuestionEntity, (q) => q.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'listening_question_id' })
  question?: AssessmentListeningQuestionEntity;

  @Column({ type: 'text' })
  text: string;

  @Column({ name: 'is_correct', type: 'boolean', default: false })
  isCorrect: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
