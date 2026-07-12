import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';

export type ShopItemType = 'package' | 'course';

@Entity('shop_items')
export class ShopItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  @Column({
    type: 'enum',
    enum: ['package', 'course'],
    default: 'package',
  })
  type: ShopItemType;

  @Column({ name: 'lessons_count', type: 'int', default: 1 })
  lessonsCount: number;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  price: number;

  @Index('IDX_SHOP_ITEM_COURSE_TEMPLATE_ID')
  @Column({ name: 'course_template_id', type: 'uuid', nullable: true })
  courseTemplateId: string | null;

  @ManyToOne(() => CourseTemplateEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'course_template_id' })
  courseTemplate?: CourseTemplateEntity | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @Index('IDX_SHOP_ITEM_SORT_ORDER')
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
