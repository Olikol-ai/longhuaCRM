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
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { OrganizationEntity } from '../../b2b-sales/entities/organization.entity';

export type GroupStatus = 'active' | 'inactive' | 'archived';

@Entity('groups')
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_GROUP_TEACHER_ID')
  @Column({ name: 'teacher_id', type: 'uuid', nullable: true })
  teacherId: string | null;

  @ManyToOne(() => TeacherEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity | null;

  @Column({ type: 'text' })
  name: string;

  @Column({
    type: 'enum',
    enum: ['active', 'inactive', 'archived'],
    default: 'active',
  })
  status: GroupStatus;

  @Index('IDX_GROUP_ORGANIZATION_ID')
  @Column({ name: 'organization_id', type: 'uuid', nullable: true })
  organizationId: string | null;

  @ManyToOne(() => OrganizationEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity | null;

  @Column({ name: 'contract_amount', type: 'numeric', precision: 12, scale: 2, nullable: true })
  contractAmount: string | null;

  @Column({ name: 'contract_currency', type: 'varchar', length: 8, default: 'BYN' })
  contractCurrency: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
