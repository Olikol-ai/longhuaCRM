import { Column, CreateDateColumn, Entity, JoinColumn, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import { ExamContentLevelEntity } from './exam-content-level.entity';
import { ExamContentBlueprintEditionEntity } from './exam-content-blueprint-edition.entity';

@Entity('exam_content_blueprints')
export class ExamContentBlueprintEntity {
  @PrimaryGeneratedColumn('uuid') id: string;
  @Column({ name: 'level_id', type: 'uuid' }) levelId: string;
  @ManyToOne(() => ExamContentLevelEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'level_id' }) level?: ExamContentLevelEntity;
  @Column({ type: 'text' }) name: string;
  @Column({ type: 'varchar', length: 32, default: 'active' }) status: string;
  @OneToMany(() => ExamContentBlueprintEditionEntity, (e) => e.blueprint) editions?: ExamContentBlueprintEditionEntity[];
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' }) createdAt: Date;
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' }) updatedAt: Date;
}
