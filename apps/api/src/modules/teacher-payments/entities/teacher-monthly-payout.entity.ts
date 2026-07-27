import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { TeacherEntity } from '../../teachers/entities/teacher.entity';

export type TeacherMonthlyPayoutStatus = 'pending' | 'paid';

/**
 * Month-level salary payout for a teacher (yyyy-MM).
 * Per-lesson TeacherPayment rows remain as accrual audit history.
 */
@Entity('teacher_monthly_payouts')
@Unique('UQ_TEACHER_MONTHLY_PAYOUT_TEACHER_MONTH', ['teacherId', 'month'])
export class TeacherMonthlyPayoutEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TEACHER_MONTHLY_PAYOUT_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity;

  /** Calendar month in `yyyy-MM` format (e.g. 2026-07). */
  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({ type: 'numeric', precision: 10, scale: 2, default: 0 })
  amount: number;

  @Column({
    type: 'varchar',
    length: 20,
    default: 'pending',
  })
  status: TeacherMonthlyPayoutStatus;

  @Column({ name: 'paid_at', type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
