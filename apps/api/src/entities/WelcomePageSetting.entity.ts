import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
  } from 'typeorm';
  
  @Entity('welcome_page_settings')
  export class WelcomePageSettingEntity {
    @PrimaryGeneratedColumn('uuid')
    id: string;
  
    @Column({ type: 'text' })
    key: string;
  
    @Column({ type: 'text', nullable: true })
    value: string;
  
    @Column({ type: 'text', nullable: true })
    description: string;
  
    @Column({ type: 'text', nullable: true })
    type: string; // string | number | boolean | json
  
    @Column({ type: 'boolean', default: true })
    isActive: boolean;
  
    @CreateDateColumn({ name: 'created_date', type: 'timestamptz' })
    createdDate: Date;
  
    @UpdateDateColumn({ name: 'updated_date', type: 'timestamptz' })
    updatedDate: Date;
  }