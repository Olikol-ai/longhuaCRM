import {
  Column,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('app_settings')
export class AppSettingEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_APP_SETTING_KEY', { unique: true })
  @Column({ type: 'varchar' })
  key: string;

  @Column({ type: 'text', default: '' })
  value: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
