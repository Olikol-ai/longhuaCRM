import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('course_folders')
export class CourseFolderEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_COURSE_FOLDER_COURSE_ID')
  @Column({ name: 'course_id', type: 'uuid' })
  courseId: string;

  @Index('IDX_COURSE_FOLDER_PARENT_ID')
  @Column({ name: 'parent_folder_id', type: 'uuid', nullable: true })
  parentFolderId: string | null;

  @Column({ type: 'text' })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
