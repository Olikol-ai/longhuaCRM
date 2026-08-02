import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentItemEntity } from './exam-content-item.entity';

@Entity('exam_content_item_grammar')
export class ExamContentItemGrammarEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ExamContentItemEntity, (i) => i.grammar, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: ExamContentItemEntity;

  @Column({ type: 'text' })
  pattern: string;

  @Column({ type: 'text', nullable: true })
  explanation: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
