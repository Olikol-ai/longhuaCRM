import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { OrganizationReceiptEntity } from './organization-receipt.entity';
import { SalesCommissionPayoutEntity } from './sales-commission-payout.entity';

export type SalesCommissionAccrualStatus = 'accrued' | 'paid';

@Entity('sales_commission_accruals')
export class SalesCommissionAccrualEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_SALES_COMMISSION_RECEIPT', { unique: true })
  @Column({ name: 'receipt_id', type: 'uuid' })
  receiptId: string;

  @ManyToOne(() => OrganizationReceiptEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'receipt_id' })
  receipt?: OrganizationReceiptEntity;

  @Index('IDX_SALES_COMMISSION_MANAGER')
  @Column({ name: 'manager_user_id', type: 'uuid', nullable: true })
  managerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'manager_user_id' })
  manager?: UserEntity | null;

  /** Rate snapshot at accrual time (%). */
  @Column({ name: 'rate_percent', type: 'numeric', precision: 5, scale: 2 })
  ratePercent: string;

  @Column({ name: 'commission_amount', type: 'numeric', precision: 12, scale: 2 })
  commissionAmount: string;

  @Column({ type: 'varchar', length: 8, default: 'BYN' })
  currency: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'accrued',
  })
  status: SalesCommissionAccrualStatus;

  @Column({ name: 'payout_id', type: 'uuid', nullable: true })
  payoutId: string | null;

  @ManyToOne(() => SalesCommissionPayoutEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'payout_id' })
  payout?: SalesCommissionPayoutEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
