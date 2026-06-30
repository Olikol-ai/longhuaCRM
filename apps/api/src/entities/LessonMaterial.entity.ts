import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type LessonMaterialFileType =
    | 'pdf'
    | 'pptx'
    | 'video'
    | 'link'
    | 'other';
  
  @Entity('lesson_materials')
  export class LessonMaterialEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text' })
    title: string;
  
    @Column({ type: 'text', nullable: true })
    description: string;

    @Column({ type: 'text', nullable: true })
    notes: string;
  
    @Column({ name: 'file_url', type: 'text', nullable: true })
    fileUrl: string | null;

    @Column({ name: 'external_link', type: 'text', nullable: true })
    externalLink: string | null;
  
    @Column({
      name: 'file_type',
      type: 'enum',
      enum: ['pdf', 'pptx', 'video', 'link', 'other'],
      default: 'other',
    })
    fileType: LessonMaterialFileType;
  
    @Index('IDX_LESSON_MATERIAL_COURSE_ID')
    @Column({ name: 'course_id', type: 'uuid' })
    courseId: string;

    @Index('IDX_LESSON_MATERIAL_FOLDER_ID')
    @Column({ name: 'folder_id', type: 'uuid', nullable: true })
    folderId: string | null;
  
    @Column({ name: 'block_name', type: 'text', nullable: true })
    blockName: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }