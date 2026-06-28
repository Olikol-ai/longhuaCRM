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
  
    @Column({ name: 'file_url', type: 'text' })
    fileUrl: string;
  
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
  
    @Column({ name: 'block_name', type: 'text', nullable: true })
    blockName: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }