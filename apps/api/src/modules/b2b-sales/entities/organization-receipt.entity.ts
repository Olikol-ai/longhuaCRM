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
import { GroupEntity } from '../../groups/entities/group.entity';
import { UserEntity } from '../../users/entities/user.entity';
import { OrganizationEntity } from './organization.entity';

export type OrganizationReceiptStatus = 'pending' | 'received' | 'cancelled';

@Entity('organization_receipts')
export class OrganizationReceiptEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ORG_RECEIPT_ORGANIZATION')
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @Index('IDX_ORG_RECEIPT_GROUP')
  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 8, default: 'BYN' })
  currency: string;

  @Column({ name: 'received_at', type: 'timestamptz', nullable: true })
  receivedAt: Date | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'received',
  })
  status: OrganizationReceiptStatus;

  @Column({ type: 'text', nullable: true })
  purpose: string | null;

  /** Snapshot of manager at receipt time — historical integrity when manager changes. */
  @Column({ name: 'sales_manager_user_id', type: 'uuid', nullable: true })
  salesManagerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_manager_user_id' })
  salesManager?: UserEntity | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
