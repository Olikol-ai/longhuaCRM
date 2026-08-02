import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentItemGroupEntity } from './exam-content-item-group.entity';
import { ExamContentItemEntity } from './exam-content-item.entity';

@Entity('exam_content_group_items')
export class ExamContentGroupItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => ExamContentItemGroupEntity, (g) => g.groupItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: ExamContentItemGroupEntity;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ExamContentItemEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: ExamContentItemEntity;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
