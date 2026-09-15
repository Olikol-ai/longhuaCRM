import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { OrganizationEntity } from './organization.entity';
import { SalesDiaryContactEntity } from './sales-diary-contact.entity';
import { SalesDiaryNoteEntity } from './sales-diary-note.entity';

export const SALES_DIARY_STATUSES = [
  'new',
  'in_progress',
  'contacted',
  'negotiations',
  'proposal_sent',
  'thinking',
  'contract_signed',
  'refused',
  'unreachable',
  'postponed',
] as const;

export type SalesDiaryStatus = (typeof SALES_DIARY_STATUSES)[number];

@Entity('sales_diary_entries')
export class SalesDiaryEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SALES_DIARY_ENTRY_ORG', { unique: true })
  @Column({ name: 'organization_id', type: 'uuid' })
  organizationId: string;

  @ManyToOne(() => OrganizationEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'organization_id' })
  organization?: OrganizationEntity;

  @Index('IDX_SALES_DIARY_ENTRY_MANAGER')
  @Column({ name: 'sales_manager_user_id', type: 'uuid', nullable: true })
  salesManagerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_manager_user_id' })
  salesManager?: UserEntity | null;

  @Column({
    type: 'varchar',
    length: 32,
    default: 'new',
  })
  status: SalesDiaryStatus;

  @Column({ name: 'next_contact_at', type: 'timestamptz', nullable: true })
  nextContactAt: Date | null;

  @Column({ name: 'potential_students_count', type: 'int', default: 0 })
  potentialStudentsCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  @OneToMany(() => SalesDiaryNoteEntity, (note) => note.entry)
  notes?: SalesDiaryNoteEntity[];

  @OneToMany(() => SalesDiaryContactEntity, (contact) => contact.entry)
  contacts?: SalesDiaryContactEntity[];
}
