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
import { LessonEntity } from '../../lessons/entities/lesson.entity';
import { MaterialEntity } from './material.entity';

@Entity('material_links')
@Index('IDX_MATERIAL_LINK_LESSON_MATERIAL', ['lessonId', 'materialId'], {
  unique: true,
})
export class MaterialLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_MATERIAL_LINK_LESSON_ID')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @ManyToOne(() => LessonEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'lesson_id' })
  lesson?: LessonEntity;

  @Index('IDX_MATERIAL_LINK_MATERIAL_ID')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  /** RESTRICT — material hard-delete must not erase lesson history links. */
  @ManyToOne(() => MaterialEntity, { nullable: false, onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'material_id' })
  material?: MaterialEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
