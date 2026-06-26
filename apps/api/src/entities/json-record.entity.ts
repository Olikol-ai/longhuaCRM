import { Column, CreateDateColumn, PrimaryColumn, UpdateDateColumn } from 'typeorm';

export abstract class JsonRecordEntity {
  @PrimaryColumn('uuid')
  id: string;

  @Column({ type: 'jsonb', default: {} })
  data: Record<string, unknown>;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
