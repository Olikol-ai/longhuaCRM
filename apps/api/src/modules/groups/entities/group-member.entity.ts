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
import { GroupEntity } from './group.entity';
import { StudentEntity } from '../../students/entities/student.entity';

@Entity('group_members')
@Index('IDX_GROUP_MEMBER_UNIQUE', ['groupId', 'studentId'], { unique: true })
export class GroupMemberEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_GROUP_MEMBER_GROUP_ID')
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => GroupEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity;

  @Index('IDX_GROUP_MEMBER_STUDENT_ID')
  @Column({ name: 'student_id', type: 'uuid' })
  studentId: string;

  @ManyToOne(() => StudentEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'student_id' })
  student?: StudentEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
