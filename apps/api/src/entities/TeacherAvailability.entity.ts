import {
    Column,
    CreateDateColumn,
    Entity,
    Index,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('teacher_availability')
  export class TeacherAvailabilityEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Index('IDX_TEACHER_AVAILABILITY_TEACHER_ID')
    @Column({ name: 'teacher_id', type: 'uuid' })
    teacherId: string;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }
  