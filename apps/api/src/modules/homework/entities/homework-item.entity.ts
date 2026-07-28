import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentQuestionEntity } from '../../assessment/entities/assessment-question.entity';
import { HomeworkEntity } from './homework.entity';

@Entity('homework_items')
export class HomeworkItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ITEMS_HOMEWORK')
  @Column({ name: 'homework_id', type: 'uuid' })
  homeworkId: string;

  @ManyToOne(() => HomeworkEntity, (h) => h.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'homework_id' })
  homework?: HomeworkEntity;

  @Index('IDX_HOMEWORK_ITEMS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity;

  /** Section / activity: test | reading | listening | speaking | writing */
  @Column({ name: 'section_key', type: 'varchar', length: 64, default: 'test' })
  sectionKey: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  points: string | null;

  /** Optional reading passage shown above this item's questions. */
  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passageText: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
