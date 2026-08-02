import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentBlueprintEntity } from './exam-content-blueprint.entity';
import { ExamContentEditionSectionEntity } from './exam-content-edition-section.entity';

@Entity('exam_content_blueprint_editions')
export class ExamContentBlueprintEditionEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'blueprint_id', type: 'uuid' }) blueprintId: string;
  @ManyToOne(() => ExamContentBlueprintEntity, (b) => b.editions, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'blueprint_id' }) blueprint?: ExamContentBlueprintEntity;
  @Column({ type: 'text' }) title: string;
  @Column({ type: 'int', default: 1 }) revision: number;
  @Column({ type: 'varchar', length: 32, default: 'draft' }) status: string;
  @Column({ name: 'supersedes_edition_id', type: 'uuid', nullable: true }) supersedesEditionId: string | null;
  @Column({ name: 'total_duration_seconds', type: 'int', default: 0 }) totalDurationSeconds: number;
  @Column({ name: 'scoring_profile_notes', type: 'text', nullable: true }) scoringProfileNotes: string | null;
  @Column({ name: 'published_at', type: 'timestamptz', nullable: true }) publishedAt: Date | null;
  @Column({ name: 'created_by_user_id', type: 'uuid', nullable: true }) createdByUserId: string | null;
  @OneToMany(() => ExamContentEditionSectionEntity, (s) => s.edition) sections?: ExamContentEditionSectionEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
