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
import { StudentEntity } from './Student.entity';

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

  @Index('IDX_PAYMENT_LESSON_ID')
  @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
  lessonId: string;

  @Index('IDX_PAYMENT_COURSE_ID')
  @Column({ name: 'course_id', type: 'uuid', nullable: true })
  courseId: string;

  @Column({ name: 'student_name', type: 'text', nullable: true })
  studentName: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'lessons_added', type: 'int', default: 0 })
  lessonsAdded: number;

  @Index('IDX_PAYMENT_PAYMENT_DATE')
  @Column({ name: 'payment_date', type: 'date', nullable: true })
  paymentDate: string;

  @Column({ type: 'text', nullable: true })
  currency: string;

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

  @Column({ name: 'package_type', type: 'text', nullable: true })
  packageType: string;

  @Index('IDX_PAYMENT_ORDER_NUMBER')
  @Column({ name: 'order_number', type: 'text', nullable: true })
  orderNumber: string;

  @Column({ name: 'external_id', type: 'text', nullable: true })
  externalId: string;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
