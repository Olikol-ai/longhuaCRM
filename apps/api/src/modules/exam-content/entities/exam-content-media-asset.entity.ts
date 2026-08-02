import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity('exam_content_media_assets')
export class ExamContentMediaAssetEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ type: 'varchar', length: 32 }) kind: string;
  @Column({ name: 'storage_key', type: 'text' }) storageKey: string;
  @Column({ type: 'varchar', length: 128, nullable: true }) mime: string | null;
  @Column({ name: 'size_bytes', type: 'bigint', nullable: true }) sizeBytes: string | null;
  @Column({ name: 'duration_ms', type: 'int', nullable: true }) durationMs: number | null;
  @Column({ type: 'varchar', length: 128, nullable: true }) checksum: string | null;
  @Column({ type: 'text', nullable: true }) title: string | null;
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: string;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true }) createdByUserId: string | null;
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
