import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentSectionEntity } from './assessment-section.entity';
import { AssessmentQuestionEntity } from './assessment-question.entity';

@Entity('assessment_exam_questions')
@Index('UQ_ASSESSMENT_EXAM_QUESTIONS', ['examId', 'questionId'], { unique: true })
export class AssessmentExamQuestionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_EXAM_QUESTIONS_EXAM')
  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => AssessmentExamEntity, (e) => e.examQuestions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity;

  @Index('IDX_ASSESSMENT_EXAM_QUESTIONS_SECTION')
  @Column({ name: 'section_id', type: 'uuid' })
  sectionId: string;

  @ManyToOne(() => AssessmentSectionEntity, (s) => s.examQuestions, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section?: AssessmentSectionEntity;

  @Index('IDX_ASSESSMENT_EXAM_QUESTIONS_QUESTION')
  @Column({ name: 'question_id', type: 'uuid' })
  questionId: string;

  @ManyToOne(() => AssessmentQuestionEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'question_id' })
  question?: AssessmentQuestionEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
