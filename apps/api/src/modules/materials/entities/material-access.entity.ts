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
import { UserEntity } from '../../users/entities/user.entity';

export type GrantedByRole = 'ADMIN' | 'TEACHER';

@Entity('material_access')
@Index('IDX_MATERIAL_ACCESS_USER_MATERIAL', ['userId', 'materialId'], {
  unique: true,
})
export class MaterialAccessEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_MATERIAL_ACCESS_USER_ID')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => UserEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

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
    type: 'enum',
    enum: ['ADMIN', 'TEACHER'],
  })
  grantedByRole: GrantedByRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
