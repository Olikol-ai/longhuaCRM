import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('sales_manager_profiles')
export class SalesManagerProfileEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_SALES_MANAGER_PROFILE_USER', { unique: true })
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  /** Current commission percent (e.g. 10.00 = 10%). */
  @Column({
    name: 'commission_percent',
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
  })
  commissionPercent: string;

  @Column({
    type: 'varchar',
    length: 16,
    default: 'active',
  })
  status: 'active' | 'inactive';

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
