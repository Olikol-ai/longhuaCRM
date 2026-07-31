import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentQuestionEntity } from '../../assessment/entities/assessment-question.entity';
import { QuestionType } from '../../assessment/enums';
import { HomeworkEntity } from './homework.entity';
import { HomeworkItemAnswerEntity } from './homework-item-answer.entity';

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

  /** Legacy provenance to assessment_questions; nullable for inline homework questions. */
  @Index('IDX_HOMEWORK_ITEMS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid', nullable: true })
  questionId: string | null;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity | null;

  @Column({ type: 'varchar', length: 32 })
  type: QuestionType | string;

  @Column({ type: 'text' })
  stem: string;

  @Column({ type: 'int', default: 1 })
  difficulty: number;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  /** Section / activity: test | reading | listening | speaking | writing */
  @Column({ name: 'section_key', type: 'varchar', length: 64, default: 'test' })
  sectionKey: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, nullable: true })
  points: string | null;

  /** Optional reading passage shown above this item. */
  @Column({ name: 'passage_text', type: 'text', nullable: true })
  passageText: string | null;

  /** Reading/listening task instructions shown before the material. */
  @Column({ name: 'task_instructions', type: 'text', nullable: true })
  taskInstructions: string | null;

  @OneToMany(() => HomeworkItemAnswerEntity, (answer) => answer.item)
  answers?: HomeworkItemAnswerEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
