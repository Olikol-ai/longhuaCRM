import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

@Entity('exam_academy_achievements')
export class ExamAcademyAchievementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index('UQ_EA_ACHIEVEMENTS_CODE', { unique: true })
  @Column({ type: 'varchar', length: 64 })
  code: string;

  @Column({ type: 'text' })
  title: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'icon_key', type: 'varchar', length: 64, nullable: true })
  iconKey: string | null;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ type: 'varchar', length: 32, default: 'active' })
  status: string;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;
}
