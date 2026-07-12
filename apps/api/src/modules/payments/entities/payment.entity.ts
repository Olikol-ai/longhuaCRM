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
import { EnrollmentEntity } from '../../courses/entities/enrollment.entity';
import { StudentEntity } from '../../students/entities/student.entity';
import { ShopItemEntity } from './shop-item.entity';

export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentProvider = 'alfa_bank' | 'cash' | 'manual';

@Entity('payments')
export class PaymentEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_PAYMENT_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'text', nullable: true })
  currency: string | null;

  @Column({
    type: 'enum',
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  })
  status: PaymentStatus;

  @Column({
    type: 'enum',
    enum: ['alfa_bank', 'cash', 'manual'],
    default: 'manual',
  })
  provider: PaymentProvider;

  @Index('IDX_PAYMENT_SHOP_ITEM_ID')
  @Column({ name: 'shop_item_id', type: 'uuid', nullable: true })
  shopItemId: string | null;

  @ManyToOne(() => ShopItemEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'shop_item_id' })
  shopItem?: ShopItemEntity | null;

  @Index('IDX_PAYMENT_ENROLLMENT_ID')
  @Column({ name: 'enrollment_id', type: 'uuid', nullable: true })
  enrollmentId: string | null;

  @ManyToOne(() => EnrollmentEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'enrollment_id' })
  enrollment?: EnrollmentEntity | null;

  @Column({ name: 'lessons_added', type: 'int', default: 0 })
  lessonsAdded: number;

  @Index('IDX_PAYMENT_ORDER_NUMBER', { unique: true })
  @Column({ name: 'order_number', type: 'text', nullable: true })
  orderNumber: string | null;

  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId: string | null;

  @Index('IDX_PAYMENT_PAYMENT_DATE')
  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string | null;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
