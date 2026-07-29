import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { UserEntity } from '../../users/entities/user.entity';
import { ChatEntity } from './chat.entity';

@Entity('chat_direct_pairs')
export class ChatDirectPairEntity {
  @PrimaryColumn({ name: 'user_id_low', type: 'uuid' })
  userIdLow: string;

  @PrimaryColumn({ name: 'user_id_high', type: 'uuid' })
  userIdHigh: string;

  @Column({ name: 'chat_id', type: 'uuid', unique: true })
  chatId: string;

  @ManyToOne(() => ChatEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'chat_id' })
  chat?: ChatEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id_low' })
  userLow?: UserEntity;

  @ManyToOne(() => UserEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id_high' })
  userHigh?: UserEntity;
}
