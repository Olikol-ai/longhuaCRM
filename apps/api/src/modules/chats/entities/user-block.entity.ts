import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';

@Entity('user_blocks')
@Unique(['blockerUserId', 'blockedUserId'])
export class UserBlockEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_USER_BLOCKS_BLOCKER')
  @Column({ name: 'blocker_user_id', type: 'uuid' })
  blockerUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocker_user_id' })
  blockerUser?: UserEntity;

  @Index('IDX_USER_BLOCKS_BLOCKED')
  @Column({ name: 'blocked_user_id', type: 'uuid' })
  blockedUserId: string;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blocked_user_id' })
  blockedUser?: UserEntity;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
