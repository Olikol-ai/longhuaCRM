import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { HomeworkEntity } from './homework.entity';

/**
 * Peer share of a homework template with another staff user (teacher/tutor).
 * Grantee may view + assign to own learners; not edit/delete/manage access.
 */
@Entity('homework_access')
@Unique('UQ_HOMEWORK_ACCESS_HW_GRANTEE', ['homeworkId', 'granteeUserId'])
export class HomeworkAccessEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_HOMEWORK_ACCESS_HOMEWORK_ID')
  @Column({ name: 'homework_id', type: 'uuid' })
  homeworkId: string;

  @ManyToOne(() => HomeworkEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'homework_id' })
  homework?: HomeworkEntity;

  @Index('IDX_HOMEWORK_ACCESS_GRANTEE_USER_ID')
  @Column({ name: 'grantee_user_id', type: 'uuid' })
  granteeUserId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'grantee_user_id' })
  granteeUser?: UserEntity;

  @Column({ name: 'granted_by_user_id', type: 'uuid', nullable: true })
  grantedByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'granted_by_user_id' })
  grantedByUser?: UserEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
