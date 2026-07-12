import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { CertificateEntity } from './certificate.entity';
import { CertificateStatus } from './certificate.entity';

@Entity('certificate_history')
export class CertificateHistoryEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('IDX_CERTIFICATE_HISTORY_CERTIFICATE_ID')
  @Column({ name: 'certificate_id', type: 'uuid' })
  certificateId: string;

  @ManyToOne(() => CertificateEntity, { nullable: false, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'certificate_id' })
  certificate?: CertificateEntity;

  @Column({ type: 'text' })
  action: string;

  @Column({ name: 'previous_status', type: 'varchar', nullable: true })
  previousStatus: CertificateStatus | null;

  @Column({ name: 'new_status', type: 'varchar', nullable: true })
  newStatus: CertificateStatus | null;

  @Index('IDX_CERTIFICATE_HISTORY_ACTOR_USER_ID')
  @Column({ name: 'actor_user_id', type: 'uuid', nullable: true })
  actorUserId: string | null;

  @ManyToOne(() => UserEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actor_user_id' })
  actorUser?: UserEntity | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
