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
import { TeacherEntity } from '../../teachers/entities/teacher.entity';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('teacher_invite_links')
export class TeacherInviteLinkEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_teacher_invite_links_teacher_id')
  @Column({ name: 'teacher_id', type: 'uuid' })
  teacherId: string;

  @ManyToOne(() => TeacherEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'teacher_id' })
  teacher?: TeacherEntity;

  @Index('UQ_teacher_invite_links_token_hash', { unique: true })
  @Column({ name: 'token_hash', type: 'text' })
  tokenHash: string;

  @Column({ type: 'text', nullable: true })
  label: string | null;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt: Date;

  @Column({ name: 'revoked_at', type: 'timestamptz', nullable: true })
  revokedAt: Date | null;

  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'created_by_user_id' })
  createdByUser?: UserEntity | null;

  @Column({ name: 'use_count', type: 'int', default: 0 })
  useCount: number;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
