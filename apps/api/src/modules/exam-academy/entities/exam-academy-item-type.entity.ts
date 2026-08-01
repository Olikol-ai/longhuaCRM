import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('exam_academy_item_types')
export class ExamAcademyItemTypeEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_EA_ITEM_TYPES_CODE', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'engine_adapter', type: 'varchar', length: 32 })
  engineAdapter: string;

  @Column({ name: 'engine_question_type', type: 'varchar', length: 64, nullable: true })
  engineQuestionType: string | null;

  @Column({ name: 'answer_shape', type: 'varchar', length: 32 })
  answerShape: string;

  @Column({ name: 'supports_auto_grade', type: 'boolean', default: true })
  supportsAutoGrade: boolean;

  @Column({ name: 'renderer_key', type: 'varchar', length: 64 })
  rendererKey: string;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
