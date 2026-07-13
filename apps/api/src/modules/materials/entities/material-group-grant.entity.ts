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
import { GroupEntity } from '../../groups/entities/group.entity';
import { MaterialEntity } from './material.entity';
import { GrantedByRole } from './material-access.entity';

@Entity('material_group_grants')
@Index('UQ_material_group_grants_group_material', ['groupId', 'materialId'], {
  unique: true,
})
export class MaterialGroupGrantEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_material_group_grants_group')
  @Column({ name: 'group_id', type: 'uuid' })
  groupId: string;

  @ManyToOne(() => GroupEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group?: GroupEntity;

  @Index('IDX_material_group_grants_material')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @ManyToOne(() => MaterialEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'material_id' })
  material?: MaterialEntity;

  @Column({ name: 'granted_by_role', type: 'varchar', length: 16, default: 'ADMIN' })
  grantedByRole: GrantedByRole;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
