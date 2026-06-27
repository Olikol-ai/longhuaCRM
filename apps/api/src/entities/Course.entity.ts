import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type CourseType = 'basic_beginner' | 'advanced_beginner' | 'advanced';
  export type CourseStatus = 'active' | 'completed' | 'paused';
  
  @Entity('courses')
  export class CourseEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_COURSE_STUDENT_ID')
    @Column({ name: 'student_id', type: 'uuid', nullable: true })
    studentId: string;
  
    @Column({ name: 'student_name', type: 'text', nullable: true })
    studentName: string;
  
    @Column({ type: 'enum', enum: ['basic_beginner', 'advanced_beginner', 'advanced'] })
    courseType: CourseType;
  
    @Column({ name: 'course_name', type: 'text', nullable: true })
    courseName: string;
  
    @Column({ name: 'total_lessons', type: 'int', default: 35 })
    totalLessons: number;
  
    @Column({ name: 'completed_lessons', type: 'int', default: 0 })
    completedLessons: number;
  
    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: string;
  
    @Column({
      type: 'enum',
      enum: ['active', 'completed', 'paused'],
      default: 'active',
    })
    status: CourseStatus;
  
    @Column({ type: 'text', nullable: true })
    notes: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }