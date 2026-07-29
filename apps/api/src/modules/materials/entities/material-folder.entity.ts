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
import { UserEntity } from '../../users/entities/user.entity';

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

  /** Owner of personal (non-course) folders — used for tutor isolation. */
  @Index('IDX_MATERIAL_FOLDERS_CREATED_BY_USER')
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: UserEntity | null;

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
