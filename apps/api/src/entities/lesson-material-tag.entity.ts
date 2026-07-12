import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('lesson_material_tags')
export class LessonMaterialTagEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_LESSON_MATERIAL_TAG_MATERIAL_ID')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @Column({ type: 'varchar', length: 128 })
  tag: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;
}
