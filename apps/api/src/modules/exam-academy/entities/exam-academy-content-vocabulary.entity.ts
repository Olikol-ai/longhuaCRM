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

@Entity('exam_academy_content_vocabulary')
export class ExamAcademyContentVocabularyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_EA_CONTENT_VOCAB_ITEM')
  @Column({ name: 'content_item_id', type: 'uuid' })
  contentItemId: string;

  @ManyToOne(() => ExamAcademyContentItemEntity, (c) => c.vocabulary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'content_item_id' })
  contentItem?: ExamAcademyContentItemEntity;

  @Column({ type: 'text' })
  word: string;

  @Column({ type: 'text', nullable: true })
  pinyin: string | null;

  @Column({ type: 'text', nullable: true })
  translation: string | null;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
