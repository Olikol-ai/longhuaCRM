import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('welcome_page_settings')
  export class WelcomePageEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text', default: 'Welcome' })
    title: string;
  
    @Column({ type: 'text', nullable: true })
    subtitle: string;
  
    @Column({ type: 'text', nullable: true })
    description: string;
  
    @Column({ type: 'text', nullable: true })
    heroImageUrl: string;
  
    @Column({ type: 'text', nullable: true })
    videoUrl: string;
  
    @Column({ type: 'boolean', default: true })
    isActive: boolean;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }