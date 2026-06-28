import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  export type TeacherStatus = 'active' | 'inactive';
  
  @Entity('teachers')
  export class TeacherEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text' })
    name: string;
  
    @Column({ name: 'first_name', type: 'text', nullable: true })
    firstName: string;
  
    @Column({ name: 'last_name', type: 'text', nullable: true })
    lastName: string;
  
    @Index('IDX_TEACHER_EMAIL', { unique: true })
    @Column({ type: 'text', nullable: true })
    email: string;
  
    @Column({ name: 'hourly_rate', type: 'numeric', nullable: true })
    hourlyRate: number;
  
    @Column({ name: 'telegram_id', type: 'text', nullable: true })
    telegramId: string;
  
    @Column({
      type: 'enum',
      enum: ['active', 'inactive'],
      default: 'active',
    })
    status: TeacherStatus;
  
    @Column({ type: 'text', nullable: true })
    specializations: string;
  
    @Index('IDX_TEACHER_USER_ID', { unique: true })
    @Column({ name: 'user_id', type: 'uuid', nullable: true })
    userId: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }