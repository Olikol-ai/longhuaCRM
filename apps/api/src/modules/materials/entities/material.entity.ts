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

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
