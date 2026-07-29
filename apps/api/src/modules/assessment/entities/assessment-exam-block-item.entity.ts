import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentExamBlockEntity } from './assessment-exam-block.entity';
import { AssessmentQuestionEntity } from './assessment-question.entity';

@Entity('assessment_exam_block_items')
@Index('UQ_ASSESSMENT_EXAM_BLOCK_ITEMS_BLOCK_QUESTION', ['blockId', 'questionId'], {
  unique: true,
})
export class AssessmentExamBlockItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_EXAM_BLOCK_ITEMS_BLOCK')
  @Column({ name: 'block_id', type: 'uuid' })
  blockId: string;

  @ManyToOne(() => AssessmentExamBlockEntity, (block) => block.items, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'block_id' })
  block?: AssessmentExamBlockEntity;

  @Index('IDX_ASSESSMENT_EXAM_BLOCK_ITEMS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => AssessmentQuestionEntity, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
