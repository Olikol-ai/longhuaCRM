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
import { MaterialFolderEntity } from './material-folder.entity';

export type MaterialFileType =
  | 'pdf'
  | 'pptx'
  | 'video'
  | 'audio'
  | 'link'
  | 'canva'
  | 'other';
export type MaterialStatus = 'active' | 'deleted';

export const MATERIAL_FILE_TYPES: MaterialFileType[] = [
  'pdf',
  'pptx',
  'video',
  'audio',
  'link',
  'canva',
  'other',
];

@Entity('materials')
export class MaterialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_MATERIAL_FOLDER_ID')
  @Column({ name: 'folder_id', type: 'uuid' })
  folderId: string;

  @ManyToOne(() => MaterialFolderEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'folder_id' })
  folder?: MaterialFolderEntity;

  @Column({ type: 'text' })
  title: string;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  /** Stored as varchar in DB (not a Postgres enum). */
  @Column({ name: 'file_type', type: 'varchar', length: 32, default: 'other' })
  fileType: MaterialFileType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'mime_type', type: 'varchar', length: 128, nullable: true })
  mimeType: string | null;

  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes: string | null;

  @Column({ name: 'duration_seconds', type: 'integer', nullable: true })
  durationSeconds: number | null;

  @Column({ name: 'original_filename', type: 'text', nullable: true })
  originalFilename: string | null;

  @Column({ name: 'stored_filename', type: 'text', nullable: true })
  storedFilename: string | null;

  /** Soft-delete status — deleted materials stay for lesson/course history. */
  @Index('IDX_MATERIALS_STATUS')
  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: MaterialStatus;

  /** User who created the material (admin or teacher). Used for teacher-owned CRUD. */
  @Index('IDX_MATERIALS_CREATED_BY_USER')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
