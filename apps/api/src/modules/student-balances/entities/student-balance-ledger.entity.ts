import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StudentEntity } from '../../students/entities/student.entity';
import { UserEntity } from '../../users/entities/user.entity';

export const STUDENT_BALANCE_OPERATION_TYPES = [
  'credit',
  'debit',
  'restore',
  'adjustment',
  'initial',
  'merge_in',
  'merge_out',
  'legacy_reconciliation',
] as const;

export type StudentBalanceOperationType =
  (typeof STUDENT_BALANCE_OPERATION_TYPES)[number];

export const STUDENT_BALANCE_SOURCE_TYPES = [
  'payment',
  'lesson',
  'attendance',
  'adjustment',
  'student_create',
  'student_merge',
  'system',
  'legacy',
] as const;

export type StudentBalanceSourceType =
  (typeof STUDENT_BALANCE_SOURCE_TYPES)[number];

/**
 * Append-only ledger of school student lesson-balance mutations.
 * `students.lesson_balance` remains the fast current counter; every change
 * must go through StudentBalanceLedgerService so history stays auditable.
 */
@Entity('student_balance_ledger')
export class StudentBalanceLedgerEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_STUDENT_BALANCE_LEDGER_STUDENT')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @Column({ type: 'int' })
  delta: number;

  @Column({ name: 'balance_before', type: 'int' })
  balanceBefore: number;

  @Column({ name: 'balance_after', type: 'int' })
  balanceAfter: number;

  @Column({ name: 'operation_type', type: 'varchar', length: 32 })
  operationType: StudentBalanceOperationType;

  @Column({ name: 'source_type', type: 'varchar', length: 32 })
  sourceType: StudentBalanceSourceType;

  @Column({ name: 'source_id', type: 'varchar', length: 64, nullable: true })
  sourceId: string | null;

  @Index('UQ_STUDENT_BALANCE_LEDGER_IDEMPOTENCY', { unique: true })
  @Column({ name: 'idempotency_key', type: 'varchar', length: 191 })
  idempotencyKey: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: UserEntity | null;

  @Index('IDX_STUDENT_BALANCE_LEDGER_CREATED')
  @Column({
    name: 'created_at',
    type: 'timestamptz',
    default: () => 'now()',
  })
  createdAt: Date;
}
