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

export type MaterialFileType = 'pdf' | 'pptx' | 'video' | 'link' | 'other';
export type MaterialStatus = 'active' | 'deleted';

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

  @Column({
    name: 'file_type',
    type: 'enum',
    enum: ['pdf', 'pptx', 'video', 'link', 'other'],
    default: 'other',
  })
  fileType: MaterialFileType;

  @Column({ type: 'text', nullable: true })
  description: string | null;

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
