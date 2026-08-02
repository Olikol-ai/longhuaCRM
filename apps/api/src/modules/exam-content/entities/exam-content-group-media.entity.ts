import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { ExamContentItemGroupEntity } from './exam-content-item-group.entity';
import { ExamContentMediaAssetEntity } from './exam-content-media-asset.entity';

@Entity('exam_content_group_media')
export class ExamContentGroupMediaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => ExamContentItemGroupEntity, (g) => g.media, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: ExamContentItemGroupEntity;

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
