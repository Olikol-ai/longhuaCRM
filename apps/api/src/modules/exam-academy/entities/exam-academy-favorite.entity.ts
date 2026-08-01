import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademyContentItemEntity } from './exam-academy-content-item.entity';

@Entity('exam_academy_favorites')
@Index('UQ_EA_FAVORITES_USER_CONTENT', ['userId', 'contentKind', 'contentId'], { unique: true })
export class ExamAcademyFavoriteEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'content_kind', type: 'varchar', length: 32 })
  contentKind: string;

  @Column({ name: 'content_id', type: 'uuid' })
  contentId: string;

  @Column({ name: 'content_item_id', type: 'uuid', nullable: true })
  contentItemId: string | null;

  @ManyToOne(() => ExamAcademyContentItemEntity, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'content_item_id' })
  contentItem?: ExamAcademyContentItemEntity | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
