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
import { AssessmentReadingQuestionEntity } from './assessment-reading-question.entity';

@Entity('assessment_reading_question_answers')
export class AssessmentReadingQuestionAnswerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_READING_QUESTION_ANSWERS_QUESTION')
  @Column({ name: 'reading_question_id', type: 'uuid' })
  readingQuestionId: string;

  @ManyToOne(() => AssessmentReadingQuestionEntity, (q) => q.answers, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'reading_question_id' })
  question?: AssessmentReadingQuestionEntity;

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
