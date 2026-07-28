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
import { TutorEntity } from './tutor.entity';

/**
 * Private tutor materials foundation (not school MaterialsHub).
 * Ready for future expansion; no payment / CRM student linkage.
 */
@Entity('tutor_materials')
export class TutorMaterialEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_TUTOR_MATERIALS_TUTOR_ID')
  @Column({ name: 'tutor_id', type: 'uuid' })
  tutorId: string;

  @ManyToOne(() => TutorEntity, (tutor) => tutor.materials, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'tutor_id' })
  tutor?: TutorEntity;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'external_link', type: 'text', nullable: true })
  externalLink: string | null;

  @Column({ name: 'file_url', type: 'text', nullable: true })
  fileUrl: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
