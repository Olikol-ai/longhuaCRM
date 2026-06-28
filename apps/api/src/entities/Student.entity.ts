import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type StudentStatus = 'active' | 'inactive' | 'paused';
  
  @Entity('students')
  export class StudentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text' })
    name: string;
  
    @Column({ name: 'first_name', type: 'text', nullable: true })
    firstName: string;
  
    @Column({ name: 'last_name', type: 'text', nullable: true })
    lastName: string;
  
    @Index('IDX_STUDENT_EMAIL', { unique: true })
    @Column({ type: 'text', nullable: true })
    email: string;
  
    @Column({ type: 'text', nullable: true })
    phone: string;
  
    @Column({ name: 'telegram_id', type: 'text', nullable: true })
    telegramId: string;
  
    @Index('IDX_STUDENT_ASSIGNED_TEACHER')
    @Column({ name: 'assigned_teacher', type: 'uuid', nullable: true })
    assignedTeacher: string;
  
    @Column({ name: 'lesson_balance', type: 'int', default: 0 })
    lessonBalance: number;
  
    @Column({ name: 'start_date', type: 'date', nullable: true })
    startDate: string;
  
    @Column({ type: 'date', nullable: true })
    birthday: string;
  
    @Column({ type: 'text', nullable: true })
    notes: string;
  
    @Column({
      type: 'enum',
      enum: ['active', 'inactive', 'paused'],
      default: 'active',
    })
    status: StudentStatus;
  
    @Index('IDX_STUDENT_USER_ID', { unique: true })
    @Column({ name: 'user_id', type: 'uuid', nullable: true })
    userId: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }