import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type GrantedByRole = 'ADMIN' | 'TEACHER';

@Index('IDX_MATERIAL_ACCESS_USER_MATERIAL_ROLE', ['userId', 'materialId', 'grantedByRole'], {
  unique: true,
})
@Entity('material_access')
export class MaterialAccessEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_MATERIAL_ACCESS_USER_ID')
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index('IDX_MATERIAL_ACCESS_MATERIAL_ID')
  @Column({ name: 'material_id', type: 'uuid' })
  materialId: string;

  @Column({
    name: 'granted_by_role',
    type: 'enum',
    enum: ['ADMIN', 'TEACHER'],
  })
  grantedByRole: GrantedByRole;

  @Column({ type: 'boolean' })
  access: boolean;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
  createdDate: Date;

  @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
  updatedDate: Date;
}
