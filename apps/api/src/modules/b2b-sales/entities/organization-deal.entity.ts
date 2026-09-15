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
import { SalesDiaryEntryEntity } from './sales-diary-entry.entity';

export type OrganizationDealStatus = 'signed' | 'cancelled';

@Entity('organization_deals')
export class OrganizationDealEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_ORGANIZATION_DEAL_ORG')
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @Column({ name: 'entry_id', type: 'uuid', nullable: true })
  entryId: string | null;

  @ManyToOne(() => SalesDiaryEntryEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'entry_id' })
  entry?: SalesDiaryEntryEntity | null;

  @Column({ name: 'sales_manager_user_id', type: 'uuid', nullable: true })
  salesManagerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_manager_user_id' })
  salesManager?: UserEntity | null;

  @Column({ name: 'group_id', type: 'uuid', nullable: true })
  groupId: string | null;

  @ManyToOne(() => GroupEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity | null;

  @Column({ name: 'students_count', type: 'int' })
  studentsCount: number;

  @Column({ name: 'price_per_student', type: 'numeric', precision: 12, scale: 2, nullable: true })
  pricePerStudent: string | null;

  @Column({ type: 'numeric', precision: 12, scale: 2 })
  amount: string;

  @Column({ type: 'varchar', length: 8, default: 'BYN' })
  currency: string;

  @Column({ name: 'contract_date', type: 'date', nullable: true })
  contractDate: string | null;

  @Column({ name: 'start_date', type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'varchar', length: 16, default: 'signed' })
  status: OrganizationDealStatus;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
