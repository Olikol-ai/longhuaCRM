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
  
    /**
     * Stored as JSONB:
     * [
     *   { day: 0, from: "10:00", to: "12:00" },
     *   ...
     * ]
     */
    @Column({ type: 'jsonb', nullable: true })
    slots: {
      day: number;
      from: string;
      to: string;
    }[];
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }
  