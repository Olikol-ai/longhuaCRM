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
import { UserEntity } from '../../users/entities/user.entity';

export type TutorStatus = 'active' | 'inactive' | 'pending';

/**
 * External partner instructor (Репетитор).
 * Separate from Teacher (school employee / payroll).
 *
 * Future split-payment fields are nullable placeholders only — no runtime finance yet:
 * - defaultLessonPrice: tutor's own lesson price
 * - commissionPercent: Longhua cut (e.g. 1)
 * - payoutAccountRef: external payout destination reference
 */
@Entity('tutors')
export class TutorEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_USER_ID', { unique: true })
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'pending'],
    default: 'pending',
  })
  status: TutorStatus;

  @Column({ name: 'display_name', type: 'text' })
  displayName: string;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ type: 'text', nullable: true })
  specializations: string | null;

  @Index('IDX_TUTOR_EMAIL', { unique: true })
  @Column({ type: 'text', nullable: true })
  email: string | null;

  @Column({ type: 'text', nullable: true })
  phone: string | null;

  /** Future: tutor-set lesson price. Not used in Stage 1. */
  @Column({
    name: 'default_lesson_price',
    type: 'numeric',
    nullable: true,
  })
  defaultLessonPrice: number | null;

  /** Future: Longhua commission percent. Not used in Stage 1. */
  @Column({
    name: 'commission_percent',
    type: 'numeric',
    nullable: true,
    default: 1,
  })
  commissionPercent: number | null;

  /** Future: payout account reference. Not used in Stage 1. */
  @Column({ name: 'payout_account_ref', type: 'text', nullable: true })
  payoutAccountRef: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
