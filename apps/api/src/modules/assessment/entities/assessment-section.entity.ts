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
import { AssessmentExamEntity } from './assessment-exam.entity';
import { AssessmentExamQuestionEntity } from './assessment-exam-question.entity';

@Entity('assessment_sections')
@Index('UQ_ASSESSMENT_SECTIONS_EXAM_KEY', ['examId', 'sectionKey'], { unique: true })
export class AssessmentSectionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ASSESSMENT_SECTIONS_EXAM_ID')
  @Column({ name: 'exam_id', type: 'uuid' })
  examId: string;

  @ManyToOne(() => AssessmentExamEntity, (e) => e.sections, {
    nullable: false,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'exam_id' })
  exam?: AssessmentExamEntity;

  @Column({ name: 'section_key', type: 'varchar', length: 64 })
  sectionKey: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'numeric', precision: 6, scale: 2 })
  weight: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => AssessmentExamQuestionEntity, (q) => q.section)
  examQuestions?: AssessmentExamQuestionEntity[];

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
