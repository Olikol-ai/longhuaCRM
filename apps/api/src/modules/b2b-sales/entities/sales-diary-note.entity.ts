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

@Entity('sales_diary_notes')
export class SalesDiaryNoteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_SALES_DIARY_NOTE_ENTRY')
  @Column({ name: 'entry_id', type: 'uuid' })
  entryId: string;

  @ManyToOne(() => SalesDiaryEntryEntity, (entry) => entry.notes, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'entry_id' })
  entry?: SalesDiaryEntryEntity;

  @Column({ name: 'sales_manager_user_id', type: 'uuid', nullable: true })
  salesManagerUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'sales_manager_user_id' })
  salesManager?: UserEntity | null;

  @Column({ type: 'text' })
  note: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
