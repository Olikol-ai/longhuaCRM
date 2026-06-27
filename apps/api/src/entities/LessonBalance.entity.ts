import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('lesson_balances')
  export class LessonBalanceEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_LESSON_BALANCE_STUDENT_ID', { unique: true })
    @Column({ name: 'student_id', type: 'uuid' })
    studentId: string;
  
    @Column({ name: 'lessons_available', type: 'int', default: 0 })
    lessonsAvailable: number;
  
    @Column({ name: 'lessons_used', type: 'int', default: 0 })
    lessonsUsed: number;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }