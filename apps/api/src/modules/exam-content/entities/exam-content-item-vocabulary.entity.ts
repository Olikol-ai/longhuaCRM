import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentItemEntity } from './exam-content-item.entity';

@Entity('exam_content_item_vocabulary')
export class ExamContentItemVocabularyEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ExamContentItemEntity, (i) => i.vocabulary, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: ExamContentItemEntity;

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
}
