import { Column, Entity, JoinColumn, OneToOne, PrimaryColumn, UpdateDateColumn } from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { DmPrivacyPolicy } from '../enums/chat.enums';

@Entity('user_privacy_settings')
export class UserPrivacySettingsEntity {
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId: string;

  @OneToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user?: UserEntity;

  @Column({ name: 'dm_policy', type: 'varchar', length: 64 })
  dmPolicy: DmPrivacyPolicy;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;
}
