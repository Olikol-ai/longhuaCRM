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
import { SalesDiaryEntryEntity } from './sales-diary-entry.entity';

export const SALES_DIARY_CONTACT_TYPES = [
  'call',
  'email',
  'meeting',
  'messenger',
  'other',
] as const;

export type SalesDiaryContactType = (typeof SALES_DIARY_CONTACT_TYPES)[number];

@Entity('sales_diary_contacts')
export class SalesDiaryContactEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SALES_DIARY_CONTACT_ENTRY')
  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @ManyToOne(() => SalesDiaryEntryEntity, (entry) => entry.contacts, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry?: SalesDiaryEntryEntity;

  @Column({ name: 'sales_manager_user_id', type: 'uuid', nullable: true })
  salesManagerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_manager_user_id' })
  salesManager?: UserEntity | null;

  @Column({ name: 'contact_type', type: 'varchar', length: 16 })
  contactType: SalesDiaryContactType;

  @Column({ name: 'contacted_at', type: 'timestamptz' })
  contactedAt: Date;

  @Column({ type: 'varchar', length: 512, nullable: true })
  result: string | null;

  @Column({ name: 'next_contact_at', type: 'timestamptz', nullable: true })
  nextContactAt: Date | null;

  @Column({ type: 'text', nullable: true })
  comment: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
