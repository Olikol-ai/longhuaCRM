import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademyContentItemEntity } from './exam-academy-content-item.entity';

@Entity('exam_academy_content_grammar')
export class ExamAcademyContentGrammarEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_CONTENT_GRAMMAR_ITEM')
  @Column({ name: 'content_item_id', type: 'uuid' })
  contentItemId: string;

  @ManyToOne(() => ExamAcademyContentItemEntity, (c) => c.grammar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_item_id' })
  contentItem?: ExamAcademyContentItemEntity;

  @Column({ type: 'text' })
  pattern: string;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
