import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('lesson_material_links')
export class LessonMaterialLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_MATERIAL_LINK_LESSON_ID')
  @Column({ name: 'lesson_id', type: 'uuid' })
  lessonId: string;

  @Index('IDX_LESSON_MATERIAL_LINK_MATERIAL_ID')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
