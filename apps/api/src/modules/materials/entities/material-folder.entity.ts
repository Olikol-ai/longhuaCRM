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
import { CourseTemplateEntity } from '../../courses/entities/course-template.entity';

@Entity('material_folders')
export class MaterialFolderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_MATERIAL_FOLDER_COURSE_TEMPLATE_ID')
  @Column({ name: 'course_template_id', type: 'uuid', nullable: true })
  courseTemplateId: string | null;

  @ManyToOne(() => CourseTemplateEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'course_template_id' })
  courseTemplate?: CourseTemplateEntity | null;

  @Index('IDX_MATERIAL_FOLDER_PARENT_ID')
  @Column({ name: 'parent_id', type: 'uuid', nullable: true })
  parentId: string | null;

  @ManyToOne(() => MaterialFolderEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'parent_id' })
  parent?: MaterialFolderEntity | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
