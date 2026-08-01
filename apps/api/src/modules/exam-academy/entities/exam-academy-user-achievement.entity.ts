import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ExamAcademyAchievementEntity } from './exam-academy-achievement.entity';

@Entity('exam_academy_user_achievements')
@Index('UQ_EA_USER_ACHIEVEMENT', ['userId', 'achievementId'], { unique: true })
export class ExamAcademyUserAchievementEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ name: 'achievement_id', type: 'uuid' })
  achievementId: string;

  @ManyToOne(() => ExamAcademyAchievementEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'achievement_id' })
  achievement?: ExamAcademyAchievementEntity;

  @Column({ name: 'earned_at', type: 'timestamptz' })
  earnedAt: Date;
}
