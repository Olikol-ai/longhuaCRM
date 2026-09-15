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

export type OrganizationStatus = 'active' | 'archived';

@Entity('organizations')
export class OrganizationEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'text' })
  name: string;

  /** Belarus UNP or other tax identifier */
  @Index('IDX_ORGANIZATION_UNP')
  @Column({ type: 'varchar', length: 32, nullable: true })
  unp: string | null;

  @Index('IDX_ORGANIZATION_SALES_MANAGER')
  @Column({ name: 'sales_manager_user_id', type: 'uuid', nullable: true })
  salesManagerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_manager_user_id' })
  salesManager?: UserEntity | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'active',
  })
  status: OrganizationStatus;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
