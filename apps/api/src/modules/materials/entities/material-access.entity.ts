import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { MaterialEntity } from './material.entity';
import { TutorStudentEntity } from '../../tutors/entities/tutor-student.entity';
import { UserEntity } from '../../users/entities/user.entity';

export type GrantedByRole = 'ADMIN' | 'TEACHER' | 'TUTOR';

@Entity('material_access')
export class MaterialAccessEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Registered account subject. Null while grant is only for a local tutor student. */
  @Index('IDX_MATERIAL_ACCESS_USER_ID')
  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity | null;

  /**
   * Tutor notebook pupil (registered or local).
   * Survives registration: when user_id is linked, this id stays so grants persist.
   */
  @Index('IDX_MATERIAL_ACCESS_TUTOR_STUDENT_ID')
  @Column({ name: 'tutor_student_id', type: 'uuid', nullable: true })
  tutorStudentId: string | null;

  @ManyToOne(() => TutorStudentEntity, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'tutor_student_id' })
  tutorStudent?: TutorStudentEntity | null;

  @Index('IDX_MATERIAL_ACCESS_MATERIAL_ID')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @ManyToOne(() => MaterialEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material?: MaterialEntity;

  @Column({ type: 'boolean' })
  access: boolean;

  @Column({
    name: 'granted_by_role',
    type: 'varchar',
    length: 16,
  })
  grantedByRole: GrantedByRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
