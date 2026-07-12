import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type ShopItemType = 'package' | 'course';

@Entity('shop_items')
export class ShopItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SHOP_ITEM_ITEM_ID', { unique: true })
  @Column({ name: 'item_id', type: 'text' })
  itemId: string;

  @Column({ type: 'text' })
  label: string;

  @Column({ type: 'int', default: 1 })
  lessons: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price: number;

  @Column({ type: 'text', nullable: true })
  note: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'text', default: 'package' })
  type: ShopItemType;

  @Index('IDX_SHOP_ITEM_SORT_ORDER')
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
