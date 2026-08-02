import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentItemEntity } from './exam-content-item.entity';
import { ExamContentMediaAssetEntity } from './exam-content-media-asset.entity';

@Entity('exam_content_item_media')
export class ExamContentItemMediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'item_id', type: 'uuid' })
  itemId: string;

  @ManyToOne(() => ExamContentItemEntity, (i) => i.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'item_id' })
  item?: ExamContentItemEntity;

  @Column({ name: 'asset_id', type: 'uuid' })
  assetId: string;

  @ManyToOne(() => ExamContentMediaAssetEntity, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'asset_id' })
  asset?: ExamContentMediaAssetEntity;

  @Column({ type: 'varchar', length: 32, default: 'stimulus' })
  role: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;
}
