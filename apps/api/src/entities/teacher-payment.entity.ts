import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type TeacherPaymentStatus = 'pending' | 'paid';
  
  @Entity('teacher_payments')
  export class TeacherPaymentEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_TEACHER_PAYMENT_TEACHER_ID')
    @Column({ name: 'teacher_id', type: 'uuid' })
    teacherId: string;
  
    @Index('IDX_TEACHER_PAYMENT_LESSON_ID')
    @Column({ name: 'lesson_id', type: 'uuid', nullable: true })
    lessonId: string;
  
    @Column({ type: 'numeric', precision: 10, scale: 2 })
    amount: number;
  
    @Column({
      type: 'enum',
      enum: ['pending', 'paid'],
      default: 'pending',
    })
    status: TeacherPaymentStatus;
  
    @Column({ type: 'text', nullable: true })
    note: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }